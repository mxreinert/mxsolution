// M9 Hevy: connect (store encrypted key), disconnect, sync workouts into workouts/workout_sets.
// Callable by the client (own account) or the coach (own clients). Daily sync: see maintenance.mjs.
import { json, bad, handler, requireUser, readJson, db, encrypt, decrypt, uuidFrom } from './_lib.mjs';

const BASE = 'https://api.hevyapp.com/v1';

async function resolveClient(ctx, clientId) {
  const c = (await db.select('clients', `id=eq.${encodeURIComponent(clientId)}&select=id,user_id,coach_id,unlocks`))[0];
  if (!c) throw bad('Kunde nicht gefunden', 404);
  const isOwn = c.user_id === ctx.user.id;
  const isCoach = ctx.profile.role === 'coach' && c.coach_id === ctx.user.id && (ctx.claims.aal === 'aal2' || ctx.profile.mfa_exempt);
  if (!isOwn && !isCoach) throw bad('Nicht erlaubt', 403);
  if (!(c.unlocks || []).includes('hevy')) throw bad('Hevy ist nicht freigeschaltet', 403);
  return c;
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

async function hevyFetch(key, path) {
  const r = await fetch(BASE + path, { headers: { 'api-key': key, accept: 'application/json' } });
  if (r.status === 401 || r.status === 403) throw bad('Hevy lehnt den API-Key ab (Hevy Pro nötig).', 400);
  if (!r.ok) throw bad('Hevy antwortet mit Status ' + r.status, 502);
  return r.json();
}

/** Import workouts newer than `since` (max 5 pages à 10). Returns number imported. */
export async function syncClient(clientId, key, since) {
  const exercises = await db.select('exercises', 'select=id,name,base');
  const byName = new Map();
  for (const e of exercises) { byName.set(norm(e.name), e.id); if (e.base && !byName.has(norm(e.base))) byName.set(norm(e.base), e.id); }

  let imported = 0;
  for (let page = 1; page <= 5; page++) {
    const body = await hevyFetch(key, `/workouts?page=${page}&pageSize=10`);
    const items = body.workouts || [];
    if (!items.length) break;
    let stop = false;
    for (const w of items) {
      const start = w.start_time || w.created_at;
      if (!start) continue;
      const day = new Date(start).toISOString().slice(0, 10);
      if (since && day < since) { stop = true; continue; }
      const wid = uuidFrom(`hevy:${clientId}:${w.id}`);
      const unmatched = new Set();
      const sets = [];
      (w.exercises || []).forEach((ex, pos) => {
        const exId = byName.get(norm(ex.title));
        if (!exId) { unmatched.add(ex.title); return; }
        let n = 0;
        for (const s of ex.sets || []) {
          n += 1;
          const type = s.type === 'warmup' ? 'warmup' : s.type === 'dropset' ? 'drop' : 'normal';
          sets.push({
            id: uuidFrom(`hevy:${clientId}:${w.id}:${pos}:${n}`), workout_id: wid, client_id: clientId, exercise_id: exId,
            pos, set_no: n, set_type: type, weight_kg: s.weight_kg ?? null, reps: s.reps ?? null,
            seconds: s.duration_seconds ?? null, distance_m: s.distance_meters ?? null,
            rir: s.rpe != null ? Math.max(0, Math.min(10, 10 - Number(s.rpe))) : null
          });
        }
      });
      await db.insert('workouts', {
        id: wid, client_id: clientId, day, session_name: w.title || 'Hevy-Training', kind: 'plan', source: 'hevy', external_id: String(w.id),
        started_at: start, finished_at: w.end_time || null,
        note: unmatched.size ? `Nicht zugeordnete Übungen: ${[...unmatched].join(', ')}` : null
      }, { upsert: true, onConflict: 'id' });
      await db.remove('workout_sets', `workout_id=eq.${wid}`);
      if (sets.length) await db.insert('workout_sets', sets);
      imported += 1;
    }
    if (stop || page >= (body.page_count || 1)) break;
  }
  await db.update('integration_secrets', `client_id=eq.${clientId}`, { hevy_synced_at: new Date().toISOString() });
  return imported;
}

export default handler(async (req) => {
  const ctx = await requireUser(req);
  const body = await readJson(req);
  const client = await resolveClient(ctx, body.clientId);

  if (body.action === 'connect') {
    const key = String(body.key || '').trim();
    if (key.length < 10 || key.length > 200) return bad('API-Key ungültig');
    await hevyFetch(key, '/workouts?page=1&pageSize=1');  // validate before storing
    await db.insert('integration_secrets', { client_id: client.id, hevy_key_enc: encrypt(key), updated_at: new Date().toISOString() }, { upsert: true, onConflict: 'client_id' });
    return json({ ok: true });
  }
  if (body.action === 'disconnect') {
    await db.update('integration_secrets', `client_id=eq.${client.id}`, { hevy_key_enc: null, hevy_synced_at: null });
    return json({ ok: true });
  }
  if (body.action === 'sync') {
    const sec = (await db.select('integration_secrets', `client_id=eq.${client.id}&select=hevy_key_enc,hevy_synced_at`))[0];
    if (!sec?.hevy_key_enc) return bad('Hevy ist nicht verbunden');
    // simple rate limit: at most once per 5 minutes
    if (sec.hevy_synced_at && Date.now() - new Date(sec.hevy_synced_at) < 5 * 60e3) return json({ imported: 0, note: 'gerade erst abgeglichen' });
    const since = sec.hevy_synced_at ? new Date(new Date(sec.hevy_synced_at) - 7 * 864e5).toISOString().slice(0, 10) : null;
    const imported = await syncClient(client.id, decrypt(sec.hevy_key_enc), since);
    return json({ imported });
  }
  return bad('Unbekannte Aktion');
});

export const config = { path: '/api/hevy' };
