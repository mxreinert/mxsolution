// Form for a module's options (declared in module.config). Used per client and for coach defaults.
// Rendered as setting rows: bold title, muted description, control below (switches on the right).
import { h, input, select, toggle, parseNum, srow, switchInput } from '../core/ui.js';

const DEFAULT_DESC = {
  fields: 'Welche Werte der Kunde im Abend-Check einträgt. Ausgeschaltete Felder tauchen bei ihm nicht auf.',
  number: 'Leer lassen = kein Ziel.'
};

/**
 * values: current option values ({key: value})
 * returns element with .values() -> {key: value}
 */
export function configForm(m, values) {
  const state = { ...values };
  const rows = [];
  for (const c of m.config || []) {
    const desc = c.desc || c.hint || DEFAULT_DESC[c.type] || '';
    if (c.type === 'number') {
      const inp = input({ type: 'number', step: c.step || 1, inputmode: String(c.step || '').includes('.') ? 'decimal' : 'numeric', value: state[c.key] ?? '', placeholder: '–' });
      inp.addEventListener('input', () => { state[c.key] = parseNum(inp.value); });
      rows.push(srow(c.label, desc, h('div', { class: 'unit-input' }, inp, c.unit ? h('span', null, c.unit) : null)));
    } else if (c.type === 'toggle') {
      const on = state[c.key] !== false && state[c.key] != null ? !!state[c.key] : false;
      rows.push(srow(c.label, c.desc || c.hint || '', switchInput(on, (v) => { state[c.key] = v; }, c.label), true));
    } else if (c.type === 'select') {
      const sel = select(c.options, state[c.key] ?? c.default);
      sel.addEventListener('change', () => { state[c.key] = sel.value; });
      rows.push(srow(c.label, desc, sel));
    } else if (c.type === 'fields') {
      const chosen = new Set(Array.isArray(state[c.key]) ? state[c.key] : (m.daily || []).map((f) => f.key));
      rows.push(srow(c.label, desc, h('div', { class: 'check-list' }, (m.daily || []).map((f) => toggle(f.label, chosen.has(f.key), (v) => {
        v ? chosen.add(f.key) : chosen.delete(f.key);
        state[c.key] = (m.daily || []).map((x) => x.key).filter((k) => chosen.has(k));
      })))));
    }
  }
  const el = h('div', { class: 'config-form' }, rows);
  el.values = () => ({ ...state });
  return el;
}
