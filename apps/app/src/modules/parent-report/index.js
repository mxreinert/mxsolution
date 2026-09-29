// M15 Eltern-Bericht: Max creates a report for parents of minors (no parent login).
// Max chooses the period and sections; the report is printed / saved as PDF and passed on by Max.
import { h, card, input, field, toggle, backLink } from '../../core/ui.js';
import { today, addDays, fmt, age } from '../../core/dates.js';

const SECTIONS = {
  training: { label: 'Training', modules: ['strength', 'cardio', 'pt'] },
  progress: { label: 'Fortschritt', modules: ['weight', 'progress', 'activity'] },
  habits: { label: 'Alltag (Schlaf, Motivation)', modules: ['sleep', 'mood'] },
  nutrition: { label: 'Ernährung & Supplemente', modules: ['nutrition', 'supplements'] }
};

async function renderReport(el, params, query, app) {
  const client = await app.loadClient(params.cid);
  const fromD = query.from || addDays(today(), -27);
  const toD = query.to || today();
  const chosen = (query.s || 'training,progress').split(',').filter((s) => SECTIONS[s]);
  const ctx = await app.buildCtx(client, fromD, toD);
  // the note is kept out of the URL (personal text)
  let note = '';
  try { note = sessionStorage.getItem('mx_report_note') || ''; } catch (e) { /* ignore */ }

  const sections = [];
  for (const key of chosen) {
    const rows = [];
    for (const mid of SECTIONS[key].modules) {
      const m = app.modules.find((x) => x.id === mid);
      if (!m?.summary || !app.isActive(m, client)) continue;
      try { rows.push(...await m.summary(ctx, fromD, toD)); } catch (e) { /* skip module on error */ }
    }
    sections.push(h('section', { class: 'report-section' },
      h('h2', null, SECTIONS[key].label),
      rows.length ? h('table', { class: 'report-table' }, h('tbody', null, rows.map((r) => h('tr', null, h('th', null, r.label), h('td', null, r.value)))))
        : h('p', { class: 'muted' }, 'Keine Daten in diesem Zeitraum.')));
  }

  el.append(
    h('div', { class: 'no-print row-actions' }, backLink(`#/c/kunde/${client.id}?tab=bericht`),
      h('button', { type: 'button', onclick: () => window.print() }, 'Drucken / als PDF speichern')),
    h('article', { class: 'report' },
      h('header', null,
        h('h1', null, `Coaching-Bericht: ${client.first_name}`),
        h('p', { class: 'muted' }, `Zeitraum ${fmt(fromD)} – ${fmt(toD)}`, client.birthdate ? ` · ${age(client.birthdate)} Jahre` : '')),
      note ? h('section', { class: 'report-section' }, h('h2', null, 'Anmerkung von Max'), h('p', null, note)) : null,
      sections,
      h('footer', { class: 'muted small' }, `Erstellt am ${fmt(today())} von Max Reinert · vertraulich, nur für die Erziehungsberechtigten`)));
}

export default {
  id: 'parent_report',
  name: 'Eltern-Bericht',
  order: 97,
  icon: 'doc',
  color: 'gray',
  description: 'Bericht für Eltern Minderjähriger zum Drucken',
  coachOnly: true,
  always: true,   // available for every client in the dashboard (shown prominently for minors)

  async coach(ctx) {
    const fromIn = input({ type: 'date', value: addDays(today(), -27) });
    const toIn = input({ type: 'date', value: today() });
    const note = input({ maxlength: 1000, placeholder: 'Persönliche Anmerkung (optional)' });
    const picks = new Set(['training', 'progress']);
    return card('Eltern-Bericht',
      h('p', { class: 'muted small' }, 'Für Eltern Minderjähriger. Du wählst, was drinsteht, und gibst ihn selbst weiter.'),
      h('div', { class: 'grid2' }, field('Von', fromIn), field('Bis', toIn)),
      Object.entries(SECTIONS).map(([k, s]) => toggle(s.label, picks.has(k), (v) => { v ? picks.add(k) : picks.delete(k); })),
      field('Anmerkung', note),
      h('button', {
        type: 'button', onclick: () => {
          try { sessionStorage.setItem('mx_report_note', note.value.trim()); } catch (e) { /* ignore */ }
          const qs = new URLSearchParams({ from: fromIn.value, to: toIn.value, s: [...picks].join(',') });
          location.hash = `#/c/bericht/${ctx.client.id}?${qs}`;
        }
      }, 'Bericht erstellen'));
  },

  routes: [
    { path: '/c/bericht/:cid', role: 'coach', render: renderReport }
  ]
};
