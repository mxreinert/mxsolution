// Strength data access + offline draft/outbox (workouts are logged offline-first).
import { q, from } from '../../core/db.js';
import { e1rm } from '../../core/metrics.js';

let exerciseCache = null;
export async function exercises() {
  if (exerciseCache) return exerciseCache;
  try {
    const rows = await q(from('exercises').select('*').order('sort'));
    localStorage.setItem('mx_exercises', JSON.stringify(rows));
    exerciseCache = rows;
  } catch (e) {
    // offline: use the last copy
    exerciseCache = JSON.parse(localStorage.getItem('mx_exercises') || '[]');
  }
  return exerciseCache;
}
export async function exerciseMap() {
  return new Map((await exercises()).map((e) => [e.id, e]));
}

export async function activePlan(clientId) {
  const rows = await q(from('training_plans').select('*').eq('client_id', clientId).eq('is_active', true).limit(1));
  return rows[0] || null;
}

export async function recentWorkouts(clientId, sinceDay, limit = 200) {
  return q(from('workouts').select('*').eq('client_id', clientId).gte('day', sinceDay)
    .order('day', { ascending: false }).order('started_at', { ascending: false }).limit(limit));
}

export async function setsForWorkouts(ids) {
  if (!ids.length) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    out.push(...await q(from('workout_sets').select('*').in('workout_id', ids.slice(i, i + 100))));
  }
  return out;
}

export async function setsForExercises(clientId, exerciseIds, limit = 600) {
  if (!exerciseIds.length) return [];
  return q(from('workout_sets').select('*, workouts!inner(day, id, other_gym)').eq('client_id', clientId)
    .in('exercise_id', exerciseIds).order('created_at', { ascending: false }).limit(limit));
}

export async function testedMaxes(clientId) {
  return q(from('tested_maxes').select('*').eq('client_id', clientId).order('day'));
}

/** Per exercise: sets of the most recent workout + best e1RM ever (for PRs).
 *  Workouts in another gym are skipped – other machines/plates make the numbers incomparable. */
export function lastTimeAndBest(sets, excludeWorkoutId) {
  const byEx = new Map();
  for (const s of sets) {
    if (s.workout_id === excludeWorkoutId || s.workouts?.other_gym) continue;
    const day = s.workouts?.day || s.day;
    let e = byEx.get(s.exercise_id);
    if (!e) { e = { lastDay: null, lastWorkout: null, last: [], best: 0, bestWeight: 0 }; byEx.set(s.exercise_id, e); }
    if (s.set_type !== 'warmup') {
      const est = e1rm(Number(s.weight_kg), s.reps);
      if (est && est > e.best) e.best = est;
      if (s.weight_kg > e.bestWeight) e.bestWeight = Number(s.weight_kg);
    }
    if (!e.lastDay || day > e.lastDay || (day === e.lastDay && s.workout_id === e.lastWorkout)) {
      if (!e.lastDay || day > e.lastDay) { e.lastDay = day; e.lastWorkout = s.workout_id; e.last = []; }
      e.last.push(s);
    }
  }
  for (const e of byEx.values()) e.last.sort((a, b) => a.set_no - b.set_no);
  return byEx;
}

// ---------- offline draft + outbox ----------
const DRAFT = (id) => 'mx_workout_' + id;
const OUTBOX = 'mx_workout_outbox';
const SYNC_ERROR = 'mx_workout_sync_error';

/** Only real connection problems count as "offline" – server errors must be shown, not hidden. */
export function isNetworkError(e) {
  return !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network error|timed? ?out/i.test(e?.message || '');
}
/** Technical text of the last server error while saving (for a screenshot to Max) */
export function lastSyncError() { try { return JSON.parse(localStorage.getItem(SYNC_ERROR) || 'null'); } catch (e) { return null; } }
export function rememberSyncError(e) {
  const text = [e?.message, e?.code, e?.details, e?.hint].filter(Boolean).join(' · ').slice(0, 400);
  localStorage.setItem(SYNC_ERROR, JSON.stringify({ text, at: new Date().toISOString() }));
}
const clearSyncError = () => localStorage.removeItem(SYNC_ERROR);

export function saveDraft(w) { localStorage.setItem(DRAFT(w.id), JSON.stringify(w)); }
export function loadDraft(id) { try { return JSON.parse(localStorage.getItem(DRAFT(id))); } catch (e) { return null; } }
export function dropDraft(id) { localStorage.removeItem(DRAFT(id)); }

export function openDrafts(clientId) {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k.startsWith('mx_workout_') || k === OUTBOX) continue;
    try { const w = JSON.parse(localStorage.getItem(k)); if (w?.client_id === clientId) out.push(w); } catch (e) { /* ignore */ }
  }
  return out;
}

function outbox() { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch (e) { return []; } }
export function queue(id) { const o = outbox(); if (!o.includes(id)) o.push(id); localStorage.setItem(OUTBOX, JSON.stringify(o)); }
export function pendingCount() { return outbox().length; }

/** Push one draft to the database: upsert workout, replace its sets. */
export async function pushWorkout(w) {
  const row = {
    id: w.id, client_id: w.client_id, plan_id: w.plan_id || null, session_key: w.session_key || null,
    session_name: w.session_name || null, day: w.day, started_at: w.started_at, finished_at: w.finished_at || null,
    kind: w.kind || 'plan', effort: w.effort ?? null, pain: !!w.pain, pain_location: w.pain ? (w.pain_location || null) : null,
    note: w.note || null, with_coach: !!w.with_coach, appointment_id: w.appointment_id || null,
    other_gym: !!w.other_gym, gym_name: w.other_gym ? (w.gym_name || '').slice(0, 80) || null : null
  };
  await q(from('workouts').upsert(row, { onConflict: 'id' }));
  const sets = [];
  w.exercises.forEach((ex, pos) => {
    let n = 0;
    ex.sets.filter((s) => s.done).forEach((s) => {
      n += 1;
      sets.push({
        id: s.id, workout_id: w.id, client_id: w.client_id, exercise_id: ex.exercise_id, pos, set_no: n,
        set_type: s.set_type || 'normal', side: s.side || null,
        weight_kg: s.weight ?? null, reps: s.reps ?? null, seconds: s.seconds ?? null,
        distance_m: s.distance ?? null, rir: s.rir ?? null
      });
    });
  });
  await q(from('workout_sets').delete().eq('workout_id', w.id));
  if (sets.length) await q(from('workout_sets').insert(sets));
}

/** Try to sync everything in the outbox. Returns number of remaining items. */
export async function syncOutbox() {
  const o = outbox();
  const left = [];
  for (const id of o) {
    const w = loadDraft(id);
    if (!w) continue;
    try {
      await pushWorkout(w);
      if (w.finished_at) dropDraft(id); else left.push(id);
    } catch (e) {
      left.push(id);
      if (!isNetworkError(e)) { console.error('sync failed', id, e); rememberSyncError(e); }
    }
  }
  localStorage.setItem(OUTBOX, JSON.stringify(left));
  if (!left.length) clearSyncError();
  return left.length;
}

window.addEventListener('online', () => { syncOutbox(); });
