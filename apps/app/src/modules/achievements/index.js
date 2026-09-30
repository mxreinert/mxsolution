// M18 Erfolge: badges + lion celebration (switch on per client in the Module tab).
// Everything is computed from existing data (workouts, sets, daily entries, check-ins) –
// no extra table. Which badges were already celebrated is remembered per device (localStorage).
import { h, clear, card, pageHead, tile, empty, skeleton, fmtNum } from '../../core/ui.js';
import { q, from } from '../../core/db.js';
import { e1rm } from '../../core/metrics.js';
import { today, addDays, relDay } from '../../core/dates.js';
import { lion } from './lion.js';

const BADGES = [
  { id: 'first_workout', title: 'Erstes Training', desc: 'Das erste Training geloggt', icon: 'dumbbell', stat: 'workouts', goal: 1 },
  { id: 'workouts_10', title: '10 Trainings', desc: '10 Trainings geloggt', icon: 'dumbbell', stat: 'workouts', goal: 10 },
  { id: 'workouts_50', title: '50 Trainings', desc: '50 Trainings geloggt', icon: 'dumbbell', stat: 'workouts', goal: 50 },
  { id: 'workouts_100', title: '100 Trainings', desc: '100 Trainings geloggt', icon: 'trophy', stat: 'workouts', goal: 100 },
  { id: 'streak_3', title: '3 Tage am Stück', desc: '3 Tage hintereinander eingetragen', icon: 'flame', stat: 'bestStreak', goal: 3 },
  { id: 'streak_7', title: '7 Tage am Stück', desc: 'Eine ganze Woche ohne Lücke', icon: 'flame', stat: 'bestStreak', goal: 7 },
  { id: 'streak_30', title: '30 Tage am Stück', desc: 'Einen Monat ohne Lücke', icon: 'flame', stat: 'bestStreak', goal: 30 },
  { id: 'first_pr', title: 'Erster Rekord', desc: 'Neues Bestgewicht in einer Übung', icon: 'trophy', stat: 'prs', goal: 1 },
  { id: 'prs_10', title: 'Rekordjäger', desc: '10 neue Rekorde', icon: 'trophy', stat: 'prs', goal: 10 },
  { id: 'checkins_4', title: 'Einen Monat dabei', desc: '4 Check-ins abgegeben', icon: 'checklist', stat: 'checkins', goal: 4 },
  { id: 'checkins_12', title: 'Drei Monate dabei', desc: '12 Check-ins abgegeben', icon: 'checklist', stat: 'checkins', goal: 12 }
];

const SEEN = (cid) => 'mx_ach_seen_' + cid;

/** Numbers behind the badges */
async function stats(clientId) {
  const [workouts, sets, days, checkins] = await Promise.all([
    q(from('workouts').select('id, day, other_gym').eq('client_id', clientId).order('day')),
    q(from('workout_sets').select('exercise_id, weight_kg, reps, set_type, workout_id').eq('client_id', clientId).limit(8000)),
    q(from('daily_entries').select('day').eq('client_id', clientId).order('day').limit(2000)),
    q(from('checkins').select('id').eq('client_id', clientId))
  ]);

  // streaks (days with an evening-check entry)
  let best = 0, run = 0, prev = null;
  for (const { day } of days) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  const last = days[days.length - 1]?.day;
  const current = last && (last === today() || last === addDays(today(), -1)) ? run : 0;

  // records: new best estimated 1RM per exercise (not the very first time, not in another gym)
  const wById = new Map(workouts.map((w) => [w.id, w]));
  const ordered = sets.filter((s) => s.set_type !== 'warmup' && wById.has(s.workout_id) && !wById.get(s.workout_id).other_gym)
    .sort((a, b) => (wById.get(a.workout_id).day < wById.get(b.workout_id).day ? -1 : 1));
  const bestBy = new Map();
  const prKeys = new Set();
  let lastPr = null;
  for (const s of ordered) {
    const v = e1rm(Number(s.weight_kg), s.reps);
    if (!v) continue;
    const b = bestBy.get(s.exercise_id);
    if (b && v > b + 0.01) {
      prKeys.add(s.exercise_id + '|' + s.workout_id);
      lastPr = { exercise_id: s.exercise_id, weight: Number(s.weight_kg), reps: s.reps, day: wById.get(s.workout_id).day };
    }
    if (!b || v > b) bestBy.set(s.exercise_id, v);
  }
  return { workouts: workouts.length, bestStreak: best, streak: current, prs: prKeys.size, checkins: checkins.length, lastPr };
}

const earnedIds = (st) => BADGES.filter((b) => (st[b.stat] || 0) >= b.goal).map((b) => b.id);

function badgeEl(b, st) {
  const have = (st[b.stat] || 0) >= b.goal;
  const val = Math.min(st[b.stat] || 0, b.goal);
  return h('div', { class: 'ach' + (have ? ' on' : '') },
    tile(b.icon, have ? 'warn' : 'gray', 46),
    h('div', { class: 'ach-title' }, b.title),
    h('div', { class: 'ach-desc' }, have ? b.desc : `${fmtNum(val)} / ${fmtNum(b.goal)}`),
    have ? null : h('div', { class: 'ach-bar' }, h('span', { style: { width: `${Math.round(val / b.goal * 100)}%` } })));
}

const grid = (st) => h('div', { class: 'ach-grid' }, BADGES.map((b) => badgeEl(b, st)));

// ---------- celebration overlay (lion laughs, dumbbell up, confetti) ----------
const COLORS = ['#2563eb', '#60a5fa', '#93c5fd', '#fbbf24', '#34c759', '#ffffff'];
function celebrate(b, more) {
  const mascot = lion(170);
  const burst = h('div', { class: 'ach-burst' }, Array.from({ length: 40 }, (_, i) => {
    const a = Math.random() * Math.PI * 2, d = 110 + Math.random() * 110;
    // style as string: CSS custom properties can't be set via Object.assign(el.style)
    return h('i', { style: `background:${COLORS[i % COLORS.length]};--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 50}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 0.15}s` });
  }));
  const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 250); };
  const ov = h('div', { class: 'ach-overlay', role: 'dialog', 'aria-label': 'Neuer Erfolg', onclick: close },
    h('div', { class: 'ach-pop' }, burst, mascot,
      h('p', { class: 'eyebrow' }, 'Neuer Erfolg'),
      h('h2', null, b.title),
      h('p', { class: 'muted' }, b.desc),
      more ? h('p', { class: 'muted small' }, `+ ${more} weitere${more === 1 ? 'r' : ''} Erfolg${more === 1 ? '' : 'e'}`) : null,
      h('button', { type: 'button' }, 'Weiter')));
  document.body.append(ov);
  navigator.vibrate?.([60, 40, 60]);
  requestAnimationFrame(() => { mascot.classList.add('laugh'); setTimeout(() => mascot.classList.remove('laugh'), 1400); });
}

export default {
  id: 'achievements',
  name: 'Erfolge',
  order: 90,
  icon: 'trophy',
  color: 'warn',
  description: 'Abzeichen und Löwen-Animation bei Meilensteinen',

  async today(ctx) {
    if (ctx.role !== 'client') return null;
    const st = await stats(ctx.client.id);
    const earned = earnedIds(st);
    let seen = null;
    try { seen = JSON.parse(localStorage.getItem(SEEN(ctx.client.id)) || 'null'); } catch (e) { /* ignore */ }
    const fresh = earned.filter((id) => !(seen || []).includes(id));
    if (fresh.length) {
      // celebrate the biggest new one (last in list order)
      const b = BADGES.find((x) => x.id === fresh[fresh.length - 1]);
      setTimeout(() => celebrate(b, fresh.length - 1), 500);
      try { localStorage.setItem(SEEN(ctx.client.id), JSON.stringify(earned)); } catch (e) { /* ignore */ }
    }
    const sub = [`${earned.length} von ${BADGES.length} geschafft`, st.streak >= 2 ? `${st.streak} Tage am Stück` : null].filter(Boolean).join(' · ');
    return h('a', { class: 'fcard ach-card', href: '#/erfolge' }, lion(52),
      h('div', { class: 'fc-body' }, h('div', { class: 'fc-title' }, 'Deine Erfolge'), h('div', { class: 'fc-sub' }, sub)));
  },

  async coach(ctx) {
    const st = await stats(ctx.client.id);
    return card(`Erfolge (${earnedIds(st).length} von ${BADGES.length})`,
      st.lastPr ? h('p', { class: 'muted small' }, `Letzter Rekord: ${fmtNum(st.lastPr.weight, 1)} kg × ${st.lastPr.reps} · ${relDay(st.lastPr.day)}`) : null,
      grid(st));
  },

  routes: [
    {
      path: '/erfolge', role: 'client',
      render: async (el, p, qy, app) => {
        el.append(h('a', { class: 'link-btn', href: '#/' }, '‹ Heute'), pageHead('Erfolge'));
        const self = app.modules.find((m) => m.id === 'achievements');
        if (!app.isActive(self, app.client)) { el.append(empty('Erfolge sind für dich noch nicht freigeschaltet.')); return; }
        const body = h('div', null, skeleton(2));
        el.append(body);
        const st = await stats(app.client.id);
        const mascot = lion(130, 'center-lion');
        mascot.addEventListener('click', () => { mascot.classList.remove('laugh'); void mascot.offsetWidth; mascot.classList.add('laugh'); });
        clear(body).append(
          h('div', { class: 'ach-hero' }, mascot,
            h('div', null, h('div', { class: 'kpi-value' }, `${earnedIds(st).length} / ${BADGES.length}`), h('div', { class: 'muted' }, 'Erfolge geschafft'),
              st.streak >= 2 ? h('div', { class: 'ach-streak' }, tile('flame', 'warn', 22), ` ${st.streak} Tage am Stück`) : null)),
          grid(st));
      }
    }
  ]
};
