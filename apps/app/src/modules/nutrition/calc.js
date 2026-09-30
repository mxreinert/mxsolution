// Kalorien- und Makro-Rechner für den Coach (Mifflin-St Jeor).
// Body data (height, sex, activity, protein/fat factors) is remembered in clients.targets.body.
import { h, card, input, select, field, toast, showError, parseNum, fmtNum } from '../../core/ui.js';
import { q, from } from '../../core/db.js';
import { age, isMinor } from '../../core/dates.js';

const PAL = [
  ['1.2', 'Sitzend, kaum Bewegung'],
  ['1.375', 'Leicht aktiv (1–3× Training/Woche)'],
  ['1.55', 'Mäßig aktiv (3–5× Training/Woche)'],
  ['1.725', 'Sehr aktiv (6–7× Training oder körperliche Arbeit)'],
  ['1.9', 'Extrem aktiv (Leistungssport + körperliche Arbeit)']
];
const KCAL_PER_KG = 7700;   // energy of 1 kg body fat (approx.)

/** Mifflin-St Jeor basal metabolic rate */
export function bmr({ sex, weight, height, years }) {
  if (!weight || !height || !years) return null;
  return 10 * weight + 6.25 * height - 5 * years + (sex === 'f' ? -161 : 5);
}

/** Latest 7-day weight average (fallback: last value) */
function currentWeight(daily) {
  const w = daily.filter((r) => r.weight_kg != null).slice(-7).map((r) => Number(r.weight_kg));
  return w.length ? Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 10) / 10 : null;
}

export function calculator(ctx) {
  const c = ctx.client;
  const t = c.targets || {};
  const body = t.body || {};
  const cut = c.goal === 'cut';

  const sex = select([['m', 'männlich'], ['f', 'weiblich']], body.sex || 'm');
  const years = input({ type: 'number', inputmode: 'numeric', value: age(c.birthdate) ?? '', placeholder: 'Jahre' });
  const height = input({ type: 'number', inputmode: 'numeric', value: body.height_cm ?? '', placeholder: 'cm' });
  const weight = input({ type: 'number', step: '0.1', inputmode: 'decimal', value: currentWeight(ctx.daily) ?? '', placeholder: 'kg' });
  const pal = select(PAL, body.pal || '1.55');
  const change = input({ type: 'number', step: '0.05', inputmode: 'decimal', value: t.weekly_change_kg ?? (cut ? -0.5 : c.goal === 'bulk' ? 0.25 : 0), placeholder: 'kg/Woche' });
  const rest = input({ type: 'number', step: '50', inputmode: 'numeric', value: body.rest_diff ?? 0, placeholder: 'kcal' });
  const protein = input({ type: 'number', step: '0.1', inputmode: 'decimal', value: body.protein_per_kg ?? (cut ? 2.2 : 1.8) });
  const fat = input({ type: 'number', step: '0.1', inputmode: 'decimal', value: body.fat_per_kg ?? 0.8 });

  const out = h('div', { class: 'calc-out' });
  let result = null;

  const calc = () => {
    const w = parseNum(weight.value), hgt = parseNum(height.value), yrs = parseNum(years.value);
    const b = bmr({ sex: sex.value, weight: w, height: hgt, years: yrs });
    if (!b) { result = null; out.replaceChildren(h('p', { class: 'muted small' }, 'Größe, Gewicht und Alter eingeben.')); return; }
    const tdee = b * Number(pal.value);
    const delta = (parseNum(change.value) || 0) * KCAL_PER_KG / 7;
    const kcal = Math.round((tdee + delta) / 10) * 10;
    const kcalRest = parseNum(rest.value) ? Math.round((kcal - Math.abs(parseNum(rest.value))) / 10) * 10 : null;
    const p = Math.round((parseNum(protein.value) || 0) * w);
    const f = Math.round((parseNum(fat.value) || 0) * w);
    const carbs = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
    result = { kcal, kcalRest, p, f, carbs, change: parseNum(change.value), b, tdee };

    const warn = [];
    if (kcal < b) warn.push('Das Ziel liegt unter dem Grundumsatz – Defizit eher verkleinern.');
    if (delta < 0 && -delta / tdee > 0.25) warn.push('Defizit über 25 % des Bedarfs – sehr aggressiv.');
    if (isMinor(c.birthdate) && delta < 0) warn.push('Minderjährig: nur ein kleines Defizit, Wachstum braucht Energie.');
    if (p * 4 + f * 9 > kcal) warn.push('Protein + Fett ergeben schon mehr Kalorien als das Ziel.');

    out.replaceChildren(
      h('table', { class: 'kv' }, h('tbody', null,
        h('tr', null, h('th', null, 'Grundumsatz'), h('td', null, `${fmtNum(b)} kcal`)),
        h('tr', null, h('th', null, 'Tagesbedarf'), h('td', null, `${fmtNum(tdee)} kcal`)),
        h('tr', null, h('th', null, delta < 0 ? 'Defizit pro Tag' : 'Überschuss pro Tag'), h('td', null, `${fmtNum(Math.abs(delta))} kcal`)),
        h('tr', { class: 'calc-main' }, h('th', null, 'Kalorienziel'), h('td', null, `${fmtNum(kcal)} kcal${kcalRest ? ` (Ruhetag ${fmtNum(kcalRest)})` : ''}`)),
        h('tr', null, h('th', null, 'Protein'), h('td', null, `${p} g`)),
        h('tr', null, h('th', null, 'Fett'), h('td', null, `${f} g`)),
        h('tr', null, h('th', null, 'Kohlenhydrate'), h('td', null, `${carbs} g`)))),
      warn.map((x) => h('p', { class: 'warn-text small' }, x)));
  };
  [sex, years, height, weight, pal, change, rest, protein, fat].forEach((x) => x.addEventListener('input', calc));
  calc();

  const apply = h('button', {
    type: 'button', onclick: async () => {
      if (!result) { toast('Erst Größe, Gewicht und Alter eingeben.', 'bad'); return; }
      const targets = {
        ...t, kcal: result.kcal, kcal_rest: result.kcalRest || null, protein_g: result.p, fat_g: result.f, carbs_g: result.carbs,
        weekly_change_kg: result.change ?? t.weekly_change_kg,
        body: { sex: sex.value, height_cm: parseNum(height.value), pal: pal.value, rest_diff: parseNum(rest.value) || 0, protein_per_kg: parseNum(protein.value), fat_per_kg: parseNum(fat.value) }
      };
      if (!targets.kcal_rest) delete targets.kcal_rest;
      try {
        await q(from('clients').update({ targets }).eq('id', c.id));
        c.targets = targets;
        toast('Als Ziele übernommen');
        ctx.refresh();
      } catch (e) { showError(e); }
    }
  }, 'Als Ziele übernehmen');

  return card('Kalorien- & Makro-Rechner',
    h('p', { class: 'muted small' }, 'Formel nach Mifflin-St Jeor. Gewicht = aktueller 7-Tage-Schnitt. 1 kg Fett ≈ 7.700 kcal. Ein Startwert – nach 2–3 Wochen am echten Gewichtsverlauf anpassen.'),
    h('div', { class: 'grid2' }, field('Geschlecht', sex), field('Alter', years)),
    h('div', { class: 'grid2' }, field('Größe (cm)', height), field('Gewicht (kg)', weight)),
    field('Aktivität', pal),
    h('div', { class: 'grid2' }, field('Ziel kg/Woche', change, 'z. B. −0,5 Diät, +0,25 Aufbau'), field('Ruhetag weniger (kcal)', rest, '0 = gleich')),
    h('div', { class: 'grid2' }, field('Protein g/kg', protein, 'Diät 2,0–2,4'), field('Fett g/kg', fat, 'mind. 0,6–0,8')),
    out, apply);
}
