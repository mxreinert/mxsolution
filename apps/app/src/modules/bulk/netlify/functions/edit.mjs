import { json, bad, requireAuth, env, bump, dayKey } from './_lib.mjs';

const MODEL = 'claude-sonnet-5';
const MUSC = ['Brust','Latissimus','Oberer Rücken','Unterer Rücken','Schultern','Bizeps','Trizeps','Quadrizeps','Hamstrings','Gesäß','Hüfte','Waden','Bauch'];

const SYSTEM = `Du übersetzt eine Änderungswunsch-Nachricht eines Athleten in eine strukturierte Liste von Datenänderungen für seine Trainings-App.

Du darfst NUR diese Felder ändern:
- "kcal": Kalorienziel, Zahl zwischen 1200 und 6000
- "protein": Proteinziel in Gramm, Zahl zwischen 50 und 400
- "mode:<Muskelgruppe>": "aufbau" oder "erhaltung". Gültige Muskelgruppen: ${MUSC.join(', ')}
- "map:<Übungsname>": Ordnet eine Übung (Name wie in Hevy) einer Muskelgruppe zu. Wert ist eine der Muskelgruppen oder "__ignore" (zählt nicht mehr ins Volumen).

Alles andere — Zunahmekorridor, Bankdrücken-Zielkurve, Blockdauer, MEV/MAV/MRV-Landmarken, Trainingsplan, gelöschte oder korrigierte Trainingseinheiten — liegt im Code der App, nicht in diesen Daten. Für solche Wünsche gib KEINE changes zurück, sondern erkläre kurz im Feld "note", dass das eine Code-Änderung ist und der Athlet das im Chat mit Claude ansprechen soll, nicht hier.

Wenn eine Übung nicht eindeutig aus der Nachricht hervorgeht (z. B. Tippfehler, mehrdeutiger Name), nimm den plausibelsten Namen aus der mitgeschickten Liste bekannter Übungen.

Antworte NUR mit einem JSON-Objekt, keine Erklärung davor oder danach, kein Markdown, exakt dieses Schema:
{"changes":[{"field":"kcal","label":"Kalorienziel","value":2500}],"note":"Ein Satz Erklärung oder leer."}

Wenn du nichts Sinnvolles änderst, gib "changes":[] zurück und erklär warum im "note"-Feld.`;

export default async (req) => {
  try { requireAuth(req); } catch (r) { return r; }
  if (req.method !== 'POST') return bad('Nur POST', 405);

  if (!(await bump('edit', 25, dayKey())))
    return bad('Tageslimit für Änderungsvorschläge erreicht (25).', 429);

  const raw = await req.text();
  if (raw.length > 20000) return bad('Anfrage zu groß', 413);

  let body;
  try { body = JSON.parse(raw); } catch { return bad('Kein gültiges JSON'); }
  const message = typeof body?.message === 'string' ? body.message.slice(0, 1000) : '';
  if (!message.trim()) return bad('Feld "message" fehlt');

  const current = body?.current && typeof body.current === 'object' ? body.current : {};

  let apiKey;
  try { apiKey = env('ANTHROPIC_API_KEY'); }
  catch (e) { return bad(e.message, 500); }

  const userMsg =
    'Aktuelle Werte als JSON:\n' + JSON.stringify(current, null, 1) +
    '\n\nÄnderungswunsch: ' + message;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: SYSTEM,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return bad('Anthropic-API Status ' + r.status + ': ' + t.slice(0, 300), 502);
    }

    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();

    let parsed;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : text);
    } catch {
      return bad('Antwort konnte nicht gelesen werden.', 502);
    }

    const validMuscle = m => MUSC.includes(m) || m === '__ignore';
    const changes = (Array.isArray(parsed.changes) ? parsed.changes : []).filter(c => {
      if (!c || typeof c.field !== 'string') return false;
      if (c.field === 'kcal') return typeof c.value === 'number' && c.value >= 1200 && c.value <= 6000;
      if (c.field === 'protein') return typeof c.value === 'number' && c.value >= 50 && c.value <= 400;
      if (c.field.startsWith('mode:')) return MUSC.includes(c.field.slice(5)) && (c.value === 'aufbau' || c.value === 'erhaltung');
      if (c.field.startsWith('map:')) return c.field.length > 4 && validMuscle(c.value);
      return false;
    }).slice(0, 20);

    return json({ changes, note: typeof parsed.note === 'string' ? parsed.note.slice(0, 400) : '' });
  } catch (e) {
    return bad('Änderungsvorschlag fehlgeschlagen: ' + e.message, 502);
  }
};

export const config = { path: '/api/edit' };
