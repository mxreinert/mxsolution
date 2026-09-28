import { json, bad, requireAuth, env, bump, dayKey } from './_lib.mjs';

const MODEL = 'claude-sonnet-5';

const SYSTEM = `Du bist ein nüchterner, evidenzorientierter Kraftsport-Coach. Du wertest die Wochendaten eines Athleten in einer Aufbauphase aus.

Kontext zum Athleten: 164 cm, Start 64 kg am 05.09.2026, Ziel Ende Februar 2027. Zweites Trainingsjahr. Split Push/Pull/Beine/Pause/Push/Pull/Pause. Trainingslog kommt aus Hevy, Ernährung aus Yazio.

Steuergrößen, an denen du bewertest:
- Zunahmerate 200–240 g pro Woche, gemessen am gleitenden 7-Tage-Durchschnitt, nie an Tageswerten
- Bankdrücken geschätztes 1RM von 82,5 auf 100 kg über 25 Wochen, also rund 0,7 kg pro Woche
- Wochenvolumen pro Muskelgruppe gegen MEV/MAV/MRV, aber nur für Gruppen, die als "aufbau" markiert sind
- Verhältnis Gewichtszunahme zu Taillenzunahme als Fettbremse
- Umsetzungsquote gegen 5 geplante Einheiten pro Woche

Regeln für deine Antwort:
- Antworte auf Deutsch, direkt, ohne Motivationssprache und ohne Lob für Selbstverständliches.
- Wenn die Daten für eine Aussage nicht reichen, sag das, statt zu raten. Weniger als 14 Tage Gewichtsdaten erlauben keine Aussage zur Rate.
- Widersprich dem Athleten, wenn die Zahlen gegen seine Einschätzung sprechen.
- Nenne höchstens EINE konkrete Anpassung für die kommende Woche. Wenn nichts zu ändern ist, sag ausdrücklich, dass nichts geändert wird.
- Trenne klar zwischen Signal und Rauschen. Einzelne Ausreißer sind kein Trend.
- Berücksichtige, dass ein Teil des Kraftzuwachses im Aufbau vom höheren Körpergewicht kommt und im Cut wieder verschwindet.

Format, genau diese vier Abschnitte, keine weiteren:
**Status** — zwei bis drei Sätze: liegt er auf Kurs, ja oder nein.
**Was auffällt** — zwei bis vier Punkte, jeder mit der Zahl, auf die er sich stützt.
**Anpassung** — eine Änderung, messbar formuliert. Oder: keine.
**Beobachten** — was in der nächsten Woche die Antwort auf die offene Frage liefert.`;

export default async (req) => {
  try { requireAuth(req); } catch (r) { return r; }
  if (req.method !== 'POST') return bad('Nur POST', 405);

  // Harte Tagesgrenze: schützt das Guthaben.
  if (!(await bump('analyze', 25, dayKey())))
    return bad('Tageslimit für Auswertungen erreicht (25).', 429);

  const raw = await req.text();
  if (raw.length > 60000) return bad('Datenpaket zu groß', 413);

  let body;
  try { body = JSON.parse(raw); } catch { return bad('Kein gültiges JSON'); }
  if (!body || typeof body.summary !== 'object' || body.summary === null)
    return bad('Feld "summary" fehlt');

  const frage = typeof body.frage === 'string' ? body.frage.slice(0, 500) : '';

  let apiKey;
  try { apiKey = env('ANTHROPIC_API_KEY'); }
  catch (e) { return bad(e.message, 500); }

  const userMsg =
    'Wochendaten als JSON:\n\n' +
    JSON.stringify(body.summary, null, 1) +
    (frage ? '\n\nZusätzliche Frage des Athleten: ' + frage : '');

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
        max_tokens: 1400,
        system: SYSTEM,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return bad('Anthropic-API Status ' + r.status + ': ' + t.slice(0, 300), 502);
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    return json({
      text,
      usage: data.usage || null,
      model: data.model || MODEL
    });
  } catch (e) {
    return bad('Auswertung fehlgeschlagen: ' + e.message, 502);
  }
};

export const config = { path: '/api/analyze' };
