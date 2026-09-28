// M12: push PT appointments into Max' Google Calendar (only his calendar, clients get .ics).
// Setup (one-time, see docs/SETUP.md): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN,
// optional GOOGLE_CALENDAR_ID (default "primary"). The Google app must be "In production",
// otherwise refresh tokens expire after 7 days.
import { json, bad, handler, requireCoach, readJson, db } from './_lib.mjs';

const configured = () => process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN;

async function accessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token'
    })
  });
  if (!r.ok) throw bad('Google-Anmeldung fehlgeschlagen (Refresh-Token prüfen)', 502);
  return (await r.json()).access_token;
}

const KIND = { strength: 'Kraft', cardio: 'Cardio', technique: 'Technik', test: 'Test', other: 'Training' };

export default handler(async (req) => {
  const { profile: coach } = await requireCoach(req);
  if (!configured()) return bad('Google Kalender ist nicht eingerichtet', 404);
  const body = await readJson(req);
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 30);
  if (!ids.length) return bad('Keine Termine');
  const cal = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || 'primary');
  const token = await accessToken();
  const g = (path, method, payload) => fetch(`https://www.googleapis.com/calendar/v3/calendars/${cal}/events${path}`, {
    method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined
  });

  const appts = await db.select('appointments', `id=in.(${ids.join(',')})&coach_id=eq.${coach.id}&select=*,appointment_clients(client_id,clients(first_name))`);
  const locIds = [...new Set(appts.map((a) => a.location_id).filter(Boolean))];
  const locs = locIds.length ? await db.select('locations', `id=in.(${locIds.join(',')})&select=id,name,address`) : [];
  let done = 0;

  for (const a of appts) {
    if (body.action === 'delete' || a.status === 'cancelled') {
      if (a.gcal_event_id) { await g('/' + encodeURIComponent(a.gcal_event_id), 'DELETE'); await db.update('appointments', `id=eq.${a.id}`, { gcal_event_id: null }); }
      done += 1;
      continue;
    }
    const names = a.appointment_clients.map((x) => x.clients?.first_name).filter(Boolean).join(', ');
    const loc = locs.find((l) => l.id === a.location_id);
    const end = new Date(new Date(a.starts_at).getTime() + a.duration_min * 60000).toISOString();
    const event = {
      summary: `PT ${KIND[a.kind] || ''}: ${names}`.trim(),
      location: loc ? [loc.name, loc.address].filter(Boolean).join(', ') : undefined,
      description: a.note || undefined,
      start: { dateTime: a.starts_at }, end: { dateTime: end }
    };
    const res = a.gcal_event_id ? await g('/' + encodeURIComponent(a.gcal_event_id), 'PATCH', event) : await g('', 'POST', event);
    if (res.ok) {
      const ev = await res.json();
      if (ev.id !== a.gcal_event_id) await db.update('appointments', `id=eq.${a.id}`, { gcal_event_id: ev.id });
      done += 1;
    } else console.error('gcal', res.status, (await res.text()).slice(0, 300));
  }
  return json({ ok: true, done });
});

export const config = { path: '/api/gcal' };
