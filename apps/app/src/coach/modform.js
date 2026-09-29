// Form for a module's options (declared in module.config). Used per client and for coach defaults.
import { h, input, select, toggle, field, parseNum } from '../core/ui.js';

/**
 * values: current option values ({key: value})
 * returns element with .values() -> {key: value}
 */
export function configForm(m, values) {
  const state = { ...values };
  const rows = [];
  for (const c of m.config || []) {
    if (c.type === 'number') {
      const inp = input({ type: 'number', step: c.step || 1, inputmode: String(c.step || '').includes('.') ? 'decimal' : 'numeric', value: state[c.key] ?? '', placeholder: c.unit || '' });
      inp.addEventListener('input', () => { state[c.key] = parseNum(inp.value); });
      rows.push(field(`${c.label}${c.unit ? ` (${c.unit})` : ''}`, inp, c.hint));
    } else if (c.type === 'toggle') {
      rows.push(toggle(c.label, state[c.key] !== false && state[c.key] != null ? !!state[c.key] : false, (v) => { state[c.key] = v; }));
    } else if (c.type === 'select') {
      const sel = select(c.options, state[c.key] ?? c.default);
      sel.addEventListener('change', () => { state[c.key] = sel.value; });
      rows.push(field(c.label, sel, c.hint));
    } else if (c.type === 'fields') {
      const chosen = new Set(Array.isArray(state[c.key]) ? state[c.key] : (m.daily || []).map((f) => f.key));
      rows.push(h('h4', null, c.label));
      rows.push(h('div', { class: 'check-list' }, (m.daily || []).map((f) => toggle(f.label, chosen.has(f.key), (v) => {
        v ? chosen.add(f.key) : chosen.delete(f.key);
        state[c.key] = (m.daily || []).map((x) => x.key).filter((k) => chosen.has(k));
      }))));
    }
  }
  const el = h('div', { class: 'config-form' }, rows);
  el.values = () => ({ ...state });
  return el;
}
