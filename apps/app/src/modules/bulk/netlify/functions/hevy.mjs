import { json, bad, requireAuth, env, bump, hourKey } from './_lib.mjs';

const BASE = 'https://api.hevyapp.com/v1';

/* Hevy liefert pro Workout verschachtelte Übungen und Sätze.
   Feldnamen werden defensiv gelesen, damit kleine API-Änderungen
   nicht sofort alles brechen. */
function normalize(w) {
  const start = w.start_time || w.startTime || w.created_at;
  const exercises = (w.exercises || []).map(ex => ({
    name: ex.title || ex.name || ex.exercise_title || 'Unbenannt',
    sets: (ex.sets || [])
      .filter(s => (s.type || s.set_type || 'normal') !== 'warmup')
      .map(s => {
        const rpe = s.rpe ?? null;
        return {
          w: Number(s.weight_kg ?? s.weightKg ?? s.weight ?? 0) || 0,
          r: Number(s.reps ?? s.repetitions ?? 0) || 0,
          rir: rpe != null ? Math.max(0, Math.round(10 - Number(rpe))) : null
        };
      })
      .filter(s => s.w > 0 || s.r > 0)
  })).filter(e => e.sets.length);

  return {
    id: 'hevy_' + (w.id || Math.random().toString(36).slice(2)),
    src: 'hevy',
    d: start ? new Date(start).toISOString().slice(0, 10) : null,
    split: w.title || w.name || 'Einheit',
    ex: exercises
  };
}

export default async (req) => {
  try { requireAuth(req); } catch (r) { return r; }
  if (req.method !== 'GET') return bad('Nur GET', 405);

  if (!(await bump('hevy', 120, hourKey())))
    return bad('Zu viele Abrufe. Später erneut versuchen.', 429);

  let key;
  try { key = env('HEVY_API_KEY'); }
  catch (e) { return bad(e.message, 500); }

  const url = new URL(req.url);
  const maxPages = Math.min(10, Number(url.searchParams.get('pages') || 5));
  const since = url.searchParams.get('since'); // ISO-Datum, optional

  const out = [];
  let page = 1;
  try {
    while (page <= maxPages) {
      const r = await fetch(`${BASE}/workouts?page=${page}&pageSize=10`, {
        headers: { 'api-key': key, accept: 'application/json' }
      });
      if (r.status === 401 || r.status === 403)
        return bad('Hevy lehnt den API-Key ab. Key prüfen — er setzt Hevy Pro voraus.', 502);
      if (!r.ok) return bad('Hevy antwortet mit Status ' + r.status, 502);

      const body = await r.json();
      const items = body.workouts || body.data || (Array.isArray(body) ? body : []);
      if (!items.length) break;

      let stop = false;
      for (const w of items) {
        const n = normalize(w);
        if (!n.d) continue;
        if (since && n.d < since) { stop = true; continue; }
        out.push(n);
      }
      if (stop) break;
      page++;
    }
  } catch (e) {
    return bad('Hevy nicht erreichbar: ' + e.message, 502);
  }

  return json({ count: out.length, workouts: out });
};

export const config = { path: '/api/hevy' };
