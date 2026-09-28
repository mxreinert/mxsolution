// Anamnese: fixed sections with required fields so nothing is forgotten.
import { h, input, textarea, select, field, toast, showError, card } from '../core/ui.js';
import { q, from } from '../core/db.js';

export const SECTIONS = [
  {
    title: 'Ziel und Motivation', fields: [
      { k: 'goal_text', l: 'Was möchtest du erreichen?', t: 'area', req: true },
      { k: 'motivation', l: 'Warum jetzt? Was motiviert dich?', t: 'area', req: true },
      { k: 'timeframe', l: 'Zeitrahmen / Anlass (z. B. Urlaub, Wettkampf)' }
    ]
  },
  {
    title: 'Training', fields: [
      { k: 'experience', l: 'Trainingserfahrung', t: 'select', o: ['keine', 'unter 1 Jahr', '1–3 Jahre', 'über 3 Jahre'], req: true },
      { k: 'current_activity', l: 'Aktuelle Aktivität, Sportarten, Verein', t: 'area', req: true },
      { k: 'days_available', l: 'Verfügbare Trainingstage pro Woche', t: 'num', req: true },
      { k: 'time_per_session', l: 'Zeit pro Einheit (Minuten)', t: 'num' },
      { k: 'preferences', l: 'Was macht dir Spaß / was gar nicht?', t: 'area' }
    ]
  },
  {
    title: 'Gesundheit', fields: [
      { k: 'injuries', l: 'Verletzungen, Schmerzen, Einschränkungen', t: 'area', req: true },
      { k: 'conditions', l: 'Erkrankungen / Medikamente (nur wenn fürs Training relevant)', t: 'area' },
      { k: 'parq_heart', l: 'Herzprobleme oder Brustschmerz bei Belastung bekannt?', t: 'select', o: ['nein', 'ja'], req: true },
      { k: 'parq_dizzy', l: 'Schwindel / Bewusstlosigkeit in den letzten 12 Monaten?', t: 'select', o: ['nein', 'ja'], req: true },
      { k: 'doctor_clearance', l: 'Ärztliche Freigabe nötig?', t: 'select', o: ['nein', 'ja – liegt vor', 'ja – fehlt noch'], req: true }
    ]
  },
  {
    title: 'Alltag', fields: [
      { k: 'occupation', l: 'Beruf / Schule', req: true },
      { k: 'sleep', l: 'Schlaf (Stunden, Qualität)', req: true },
      { k: 'stress', l: 'Stresslevel', t: 'select', o: ['niedrig', 'mittel', 'hoch'], req: true },
      { k: 'daily_steps', l: 'Aktivität im Alltag (ca. Schritte, Arbeitsweg)' }
    ]
  },
  {
    title: 'Ernährung', fields: [
      { k: 'nutrition_habits', l: 'Aktuelle Gewohnheiten (Mahlzeiten, typischer Tag)', t: 'area', req: true },
      { k: 'tracking_experience', l: 'Erfahrung mit Kalorien-Tracking', t: 'select', o: ['keine', 'etwas', 'viel'], req: true },
      { k: 'intolerances', l: 'Unverträglichkeiten, Allergien, vegetarisch/vegan', t: 'area', req: true },
      { k: 'supplements', l: 'Aktuelle Supplemente' }
    ]
  },
  {
    title: 'Ausrüstung', fields: [
      { k: 'gym', l: 'Trainingsort', t: 'select', o: ['Fitnessstudio', 'Zuhause', 'draußen', 'gemischt'], req: true },
      { k: 'equipment', l: 'Verfügbare Geräte / Studio-Name', t: 'area' }
    ]
  }
];

export const EMERGENCY = [
  { k: 'name', l: 'Name', req: true }, { k: 'relation', l: 'Beziehung (z. B. Mutter)', req: true },
  { k: 'phone', l: 'Telefon', req: true }, { k: 'notes', l: 'Hinweise für den Notfall (z. B. Asthma-Spray)', t: 'area' }
];

export function missingRequired(client) {
  const a = client.anamnesis || {};
  const e = client.emergency || {};
  const miss = [];
  SECTIONS.forEach((s) => s.fields.forEach((f) => { if (f.req && (a[f.k] === undefined || a[f.k] === null || a[f.k] === '')) miss.push(f.l); }));
  EMERGENCY.forEach((f) => { if (f.req && !e[f.k]) miss.push('Notfallkontakt: ' + f.l); });
  return miss;
}

function control(f, value) {
  if (f.t === 'area') return textarea({ value: value ?? '', maxlength: 2000 });
  if (f.t === 'select') return select([['', '– bitte wählen –'], ...f.o.map((o) => [o, o])], value ?? '');
  if (f.t === 'num') return input({ type: 'number', value: value ?? '', inputmode: 'numeric' });
  return input({ value: value ?? '', maxlength: 300 });
}

export function renderAnamnesis(el, client, onSaved) {
  const a = client.anamnesis || {};
  const e = client.emergency || {};
  const ctrls = [];
  const miss = missingRequired(client);

  if (!client.anamnesis_consent_at && !client.consent_at) {
    el.append(h('div', { class: 'card warn-border' }, h('strong', null, '⚠️ Einwilligung zur Anamnese fehlt'),
      h('p', { class: 'muted small' }, 'Gesundheitsdaten erst speichern, wenn die Einwilligung vorliegt (Tab „Konzept“ → Einwilligungen).')));
  }
  if (miss.length) el.append(h('p', { class: 'warn-text' }, `${miss.length} Pflichtfeld(er) offen`));

  for (const s of SECTIONS) {
    const c = card(s.title);
    for (const f of s.fields) {
      const ctl = control(f, a[f.k]);
      ctrls.push({ f, ctl, target: 'anamnesis' });
      c.append(field(f.l + (f.req ? ' *' : ''), ctl));
    }
    el.append(c);
  }
  const ec = card('Notfallkontakt (im PT-Termin mit einem Tipp erreichbar)');
  for (const f of EMERGENCY) {
    const ctl = control(f, e[f.k]);
    ctrls.push({ f, ctl, target: 'emergency' });
    ec.append(field(f.l + (f.req ? ' *' : ''), ctl));
  }
  el.append(ec);

  el.append(h('button', {
    type: 'button', class: 'sticky-save', onclick: async () => {
      const anamnesis = { ...a }; const emergency = { ...e };
      for (const { f, ctl, target } of ctrls) {
        const v = f.t === 'num' ? (ctl.value === '' ? null : Number(ctl.value)) : ctl.value.trim();
        (target === 'anamnesis' ? anamnesis : emergency)[f.k] = v === '' ? null : v;
      }
      anamnesis.updated = new Date().toISOString().slice(0, 10);
      try {
        await q(from('clients').update({ anamnesis, emergency }).eq('id', client.id));
        toast('Anamnese gespeichert');
        onSaved?.();
      } catch (err) { showError(err); }
    }
  }, 'Anamnese speichern'));
}
