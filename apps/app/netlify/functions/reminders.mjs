// Scheduled every 30 minutes (fixed windows instead of minute-exact, keeps the free tier):
// 1. reminders (weigh, evening check, training, check-in, PT 2 days/2 hours before)
// 2. push for new notifications (feedback, plan, messages, coach alerts)
// Respects pause status, quiet hours and mute; after mute/quiet: ONE "Das ist neu" summary, only if something is new.
import webpush from 'web-push';
import { scheduled, db, env, luxNow, minutes } from './_lib.mjs';

const WINDOW = 30; // minutes

function inQuiet(hhmm, from, to) {
  const n = minutes(hhmm), f = minutes(from), t = minutes(to);
  return f <= t ? n >= f && n < t : n >= f || n < t;
}
const due = (time, hhmm) => { const d = minutes(hhmm) - minutes(time); return d >= 0 && d < WINDOW; };

async function sendTo(subs, payload, dead) {
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, JSON.stringify(payload), { TTL: 3600 });
      sent += 1;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.id);
      else console.warn('push failed', e.statusCode, e.body);
    }
  }
  return sent;
}

export default scheduled('reminders', async () => {
  if (!process.env.VAPID_PRIVATE_KEY) return { skipped: 'no VAPID_PRIVATE_KEY' };
  webpush.setVapidDetails(env('VAPID_SUBJECT', 'mailto:coaching@mxreinert.de'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));

  const now = luxNow();
  const subs = await db.select('push_subscriptions', 'select=id,user_id,endpoint,p256dh,auth_key');
  if (!subs.length) return { sent: 0, note: 'no subscriptions' };
  const subsBy = new Map();
  for (const s of subs) { if (!subsBy.has(s.user_id)) subsBy.set(s.user_id, []); subsBy.get(s.user_id).push(s); }
  const dead = [];
  let sent = 0;

  // ---------- clients ----------
  const clients = await db.select('clients', `user_id=not.is.null&status=in.(active,maintenance,reduced,paused_sick,paused_other)&select=id,user_id,coach_id,status,checkin_weekday,targets,unlocks`);
  const settings = clients.length ? await db.select('client_settings', `client_id=in.(${clients.map((c) => c.id).join(',')})&select=*`) : [];
  const coachSettings = await db.select('coach_settings', 'select=coach_id,settings');
  const today = await db.select('daily_entries', `day=eq.${now.day}&select=client_id,weight_kg,kcal,steps,sleep_h,motivation`);
  const monday = (() => { const d = new Date(now.day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((now.weekday + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const checkins = await db.select('checkins', `week_start=eq.${monday}&select=client_id`);
  const workoutsToday = await db.select('workouts', `day=eq.${now.day}&select=client_id`);

  for (const c of clients) {
    const my = subsBy.get(c.user_id);
    if (!my) continue;
    const s = settings.find((x) => x.client_id === c.id) || {};
    const paused = c.status.startsWith('paused');
    const muted = s.mute_until && new Date(s.mute_until) > new Date();
    const quiet = inQuiet(now.hhmm, s.quiet_from || '22:00', s.quiet_to || '07:00');
    if (paused || muted || quiet) continue;

    const defaults = coachSettings.find((x) => x.coach_id === c.coach_id)?.settings?.reminders || {};
    const rem = { weigh: { on: true, time: '07:00' }, evening: { on: true, time: '20:30' }, training: { on: true, time: '16:00' }, checkin: { on: true, time: '18:00' }, ...defaults, ...(s.reminders || {}) };
    const entry = today.find((e) => e.client_id === c.id);
    const msgs = [];
    if (rem.weigh?.on && due(rem.weigh.time, now.hhmm) && entry?.weight_kg == null) msgs.push({ title: '⚖️ Morgens wiegen', body: 'Nüchtern ist am genauesten – 10 Sekunden.', url: '/home.html#/eintragen?nur=weight_kg', tag: 'weigh' });
    if (rem.evening?.on && due(rem.evening.time, now.hhmm) && !entry) msgs.push({ title: '✍️ Abend-Check', body: 'Kurz die Werte von heute eintragen – unter 2 Minuten.', url: '/home.html#/eintragen', tag: 'evening' });
    const cardioToday = (c.targets?.cardio_week || []).filter((p) => Number(p.wd) === now.weekday);
    if (rem.training?.on && due(rem.training.time, now.hhmm) && cardioToday.length && !workoutsToday.some((w) => w.client_id === c.id)) {
      msgs.push({ title: '🏃 Heute steht Training an', body: cardioToday.map((p) => `${p.duration_min || ''} min ${p.kind}`).join(', '), url: '/home.html#/training', tag: 'training' });
    }
    if (rem.checkin?.on && due(rem.checkin.time, now.hhmm) && now.weekday === c.checkin_weekday && !checkins.some((x) => x.client_id === c.id)) {
      msgs.push({ title: '📋 Check-in', body: 'Dein wöchentlicher Check-in ist fällig.', url: '/home.html#/checkin', tag: 'checkin' });
    }
    for (const m of msgs) sent += await sendTo(my, m, dead);
  }

  // ---------- PT reminders (2 days before at the evening slot, 2 hours before) ----------
  const soon = await db.select('appointments', `status=eq.planned&starts_at=gte.${new Date().toISOString()}&starts_at=lte.${new Date(Date.now() + 49 * 3600e3).toISOString()}&select=id,starts_at,location_id,appointment_clients(client_id,status,clients(user_id))`);
  for (const a of soon) {
    const hoursLeft = (new Date(a.starts_at) - Date.now()) / 3600e3;
    const twoHours = hoursLeft <= 2 && hoursLeft > 2 - WINDOW / 60;
    const twoDays = hoursLeft <= 48 && hoursLeft > 48 - WINDOW / 60;
    if (!twoHours && !twoDays) continue;
    const time = new Date(a.starts_at).toLocaleString('de-DE', { timeZone: 'Europe/Luxembourg', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    for (const ac of a.appointment_clients || []) {
      if (!['open', 'confirmed'].includes(ac.status)) continue;
      const my = subsBy.get(ac.clients?.user_id);
      if (my) sent += await sendTo(my, { title: twoHours ? '👥 Gleich Personal Training' : '👥 In 2 Tagen Personal Training', body: time, url: '/home.html#/heute', tag: 'pt-' + a.id }, dead);
    }
  }

  // ---------- new notifications -> push ----------
  const pending = await db.select('notifications', `pushed_at=is.null&created_at=gte.${new Date(Date.now() - 48 * 3600e3).toISOString()}&select=id,user_id,client_id,title,body,link,kind&order=created_at`);
  const byUser = new Map();
  for (const n of pending) { if (!byUser.has(n.user_id)) byUser.set(n.user_id, []); byUser.get(n.user_id).push(n); }
  const pushedIds = [];
  for (const [userId, list] of byUser) {
    const my = subsBy.get(userId);
    const clientRow = clients.find((c) => c.user_id === userId);
    if (clientRow) {
      const s = settings.find((x) => x.client_id === clientRow.id) || {};
      const muted = s.mute_until && new Date(s.mute_until) > new Date();
      if (muted || inQuiet(now.hhmm, s.quiet_from || '22:00', s.quiet_to || '07:00')) continue; // keep for the summary later
    }
    if (my) {
      if (list.length === 1) {
        const n = list[0];
        sent += await sendTo(my, { title: n.title, body: n.body || '', url: '/home.html' + (n.link || '#/'), tag: 'n' + n.id }, dead);
      } else {
        sent += await sendTo(my, { title: 'Das ist neu', body: list.slice(0, 4).map((n) => n.title).join(' · '), url: '/home.html', tag: 'summary' }, dead);
      }
    }
    pushedIds.push(...list.map((n) => n.id));
  }
  if (pushedIds.length) await db.update('notifications', `id=in.(${pushedIds.join(',')})`, { pushed_at: new Date().toISOString() });
  if (dead.length) await db.remove('push_subscriptions', `id=in.(${dead.join(',')})`);
  return { sent, notifications: pushedIds.length, removed: dead.length, at: now.hhmm };
});

export const config = { schedule: '*/30 * * * *' };
