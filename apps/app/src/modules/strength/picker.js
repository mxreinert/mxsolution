// Exercise picker (search + muscle filter). Resolves with an exercise or null.
import { h, modal, input, select, clear } from '../../core/ui.js';
import { exercises } from './data.js';

export async function pickExercise({ suggest = [] } = {}) {
  const all = (await exercises()).filter((e) => e.active);
  const muscles = [...new Set(all.map((e) => e.primary_muscle))].sort();
  const search = input({ type: 'search', placeholder: 'Übung suchen …', autocomplete: 'off' });
  const muscle = select([['', 'Alle Muskelgruppen'], ...muscles.map((m) => [m, m])], '');
  const list = h('div', { class: 'picker-list' });

  return modal('Übung wählen', (close) => {
    const render = () => {
      clear(list);
      const term = search.value.trim().toLowerCase();
      let rows = all.filter((e) => (!muscle.value || e.primary_muscle === muscle.value) &&
        (!term || e.name.toLowerCase().includes(term) || (e.base || '').toLowerCase().includes(term) || (e.equipment || '').toLowerCase().includes(term)));
      if (!term && !muscle.value && suggest.length) {
        const sug = suggest.map((id) => all.find((e) => e.id === id)).filter(Boolean);
        if (sug.length) {
          list.append(h('p', { class: 'muted small' }, 'Alternativen'));
          sug.forEach((e) => list.append(row(e)));
          list.append(h('p', { class: 'muted small' }, 'Alle Übungen'));
        }
      }
      rows = rows.slice(0, 80);
      rows.forEach((e) => list.append(row(e)));
      if (!rows.length) list.append(h('p', { class: 'muted' }, 'Keine Übung gefunden.'));
    };
    const row = (e) => h('button', { type: 'button', class: 'picker-row', onclick: () => close(e) },
      h('strong', null, e.name),
      h('small', { class: 'muted' }, [e.primary_muscle, e.equipment].filter(Boolean).join(' · ')));
    search.addEventListener('input', render);
    muscle.addEventListener('change', render);
    render();
    setTimeout(() => search.focus(), 50);
    return h('div', null, h('div', { class: 'grid2' }, search, muscle), list);
  });
}
