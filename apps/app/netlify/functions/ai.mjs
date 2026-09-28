// M10 KI-Analyse (coach only). Sends only numbers – no name, no username – to the Anthropic API.
// Requires: unlock "ai" + documented consent (extra_consents.ai). Daily limit protects the budget.
import { json, bad, handler, requireCoach, ownClient, readJson, db, env } from './_lib.mjs';

const MODEL = () => env('AI_MODEL', 'claude-sonnet-5');
const DAILY_LIMIT = () => Number(env('AI_DAILY_LIMIT', '20'));

const SYSTEM = `Du bist ein nüchterner, evidenzorientierter Fitness-Coach-Assistent. Du wertest anonymisierte Tracking-Daten eines Coaching-Kunden für den Coach aus (nicht für den Kunden direkt).

Regeln:
- Antworte auf Deutsch, direkt, ohne Motivationssprache.
- Bewerte Gewicht nur am 7-Tage-Durchschnitt, nie an Einzelwerten. Unter 14 Tagen Gewichtsdaten keine Aussage zur Rate.
- Wenn Daten fehlen oder lückenhaft sind, sag das statt zu raten. Lücken sind keine Nullen.
- Pausen (Krankheit/Urlaub) erklären Einbrüche.
- Keine medizinischen Diagnosen. Bei Warnsignalen (sehr wenig kcal, schneller Gewichtsverlust, dauerhaft niedrige Motivation/Schlaf, Schmerzen) klar darauf hinweisen, dass der Coach das persönlich klären soll.
- Höchstens EINE konkrete Anpassung vorschlagen. Wenn nichts zu ändern ist, sag das ausdrücklich.

Format, genau diese vier Abschnitte:
**Status** — zwei bis drei Sätze: auf Kurs, ja oder nein.
**Was auffällt** — zwei bis vier Punkte, jeder mit der Zahl, auf die er sich stützt.
**Anpassung** — eine Änderung, messbar formuliert. Oder: keine.
**Beobachten** — was in der nächsten Woche die offene Frage beantwortet.`;

const r1 = (v) => (v == null ? null : Math.round(Number(v) * 10) / 10);

async function buildSummary(client, from, to) {
  const q = `client_id=eq.${client.id}&day=gte.${from}&day=lte.${to}`;
  const daily = await db.select('daily_entries', `${q}&select=day,weight_kg,kcal,protein_g,carbs_g,fat_g,steps,active_kcal,sleep_h,sleep_quality,motivation,energy,resting_hr,not_tracked&order=day`);
  const workouts = await db.select('workouts', `${q}&select=id,day,session_name,effort,pain,kind,with_coach`);
  const ids = workouts.map((w) => w.id);
  const sets = ids.length ? await db.select('workout_sets', `workout_id=in.(${ids.join(',')})&select=workout_id,exercise_id,set_type,weight_kg,reps,rir`) : [];
  const cardio = await db.select('cardio_sessions', `${q}&select=day,kind,duration_min,distance_km,intensity,effort`);
  const checkins = await db.select('checkins', `client_id=eq.${client.id}&week_start=gte.${from}&select=week_start,rating,hunger,stress,recovery`);
  const status = await db.select('client_status_log', `client_id=eq.${client.id}&created_at=gte.${from}&select=status,created_at`);

  // per exercise: best estimated 1RM per day (Epley ≤ 10 reps)
  const dayOf = new Map(workouts.map((w) => [w.id, w.day]));
  const perf = {};
  for (const s of sets) {
    if (s.set_type === 'warmup' || !s.weight_kg || !s.reps || s.reps > 10) continue;
    const e = s.reps === 1 ? Number(s.weight_kg) : Number(s.weight_kg) * (1 + s.reps / 30);
    const d = dayOf.get(s.workout_id);
    perf[s.exercise_id] ??= {};
    perf[s.exercise_id][d] = Math.max(perf[s.exercise_id][d] || 0, Math.round(e * 10) / 10);
  }
  const age = client.birthdate ? Math.floor((Date.now() - new Date(client.birthdate)) / (365.25 * 864e5)) : null;

  return {
    zeitraum: { von: from, bis: to },
    ziel: client.goal, status: client.status, alter_gruppe: age == null ? null : age < 18 ? 'unter 18' : age < 30 ? '18-29' : age < 45 ? '30-44' : '45+',
    zielwerte: client.targets,
    tageswerte: daily.map((d) => ({ ...d, weight_kg: r1(d.weight_kg), sleep_h: r1(d.sleep_h) })),
    krafttraining: {
      einheiten: workouts.map((w) => ({ tag: w.day, einheit: w.session_name, anstrengung: w.effort, schmerzen: w.pain, frei: w.kind === 'free', mit_coach: w.with_coach })),
      saetze_gesamt: sets.filter((s) => s.set_type !== 'warmup').length,
      e1rm_verlauf: perf
    },
    cardio,
    checkins,
    statuswechsel: status
  };
}

export default handler(async (req) => {
  const { profile: coach } = await requireCoach(req);
  const body = await readJson(req);
  const client = await ownClient(coach.id, body.clientId);
  if (!(client.unlocks || []).includes('ai')) return bad('KI-Analyse ist für diesen Kunden nicht freigeschaltet', 403);
  if (!client.extra_consents?.ai) return bad('Keine dokumentierte Einwilligung zur KI-Übertragung', 403);

  const from = /^\d{4}-\d{2}-\d{2}$/.test(body.from || '') ? body.from : null;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(body.to || '') ? body.to : null;
  if (!from || !to || from > to) return bad('Zeitraum ungültig');
  if ((new Date(to) - new Date(from)) / 864e5 > 120) return bad('Maximal 120 Tage');

  // daily limit across all clients of this coach
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const coachClients = await db.select('clients', `coach_id=eq.${coach.id}&select=id`);
  const todays = await db.select('ai_analyses', `client_id=in.(${coachClients.map((c) => c.id).join(',')})&created_at=gte.${since.toISOString()}&select=id`);
  if (todays.length >= DAILY_LIMIT()) return bad(`Tageslimit erreicht (${DAILY_LIMIT()} Analysen)`, 429);

  const summary = await buildSummary(client, from, to);
  const question = typeof body.question === 'string' ? body.question.slice(0, 300) : '';
  const userMsg = 'Daten als JSON:\n\n' + JSON.stringify(summary) + (question ? `\n\nFrage des Coaches: ${question}` : '');
  if (userMsg.length > 150000) return bad('Datenmenge zu groß – kürzeren Zeitraum wählen', 413);

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL(), max_tokens: 4000, system: SYSTEM, messages: [{ role: 'user', content: userMsg }] })
  });
  if (!r.ok) {
    const t = await r.text();
    console.error('anthropic', r.status, t.slice(0, 500));
    return bad(`KI-Dienst antwortet mit Status ${r.status}`, 502);
  }
  const data = await r.json();
  if (data.stop_reason === 'refusal') return bad('Die KI hat diese Anfrage abgelehnt.', 502);
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!text) return bad('Leere Antwort der KI', 502);

  await db.insert('ai_analyses', { client_id: client.id, period_from: from, period_to: to, model: MODEL(), result: text });
  return json({ result: text });
});

export const config = { path: '/api/ai' };
