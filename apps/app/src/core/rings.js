// Activity rings (Apple-Watch style) and a compact single ring.
import { h } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };

/**
 * rings([{ value: 0..∞ (1 = goal), color: 'pink'|'ok'|'teal'|..., label, text }], { size })
 * Concentric rings, outermost first. Values above 1 overlap (like Apple).
 */
export function rings(items, { size = 150 } = {}) {
  const stroke = Math.max(10, Math.round(size / (items.length * 2 + 2.2)));
  const gap = Math.round(stroke * 0.18);
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'rings', role: 'img' });
  items.forEach((it, i) => {
    const r = size / 2 - stroke / 2 - i * (stroke + gap);
    if (r <= stroke / 2) return;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, it.value || 0);
    svg.append(s('circle', { cx: size / 2, cy: size / 2, r, class: 'ring-track ring-' + it.color, 'stroke-width': stroke, fill: 'none' }));
    const arc = s('circle', {
      cx: size / 2, cy: size / 2, r, class: 'ring-arc ring-' + it.color, 'stroke-width': stroke, fill: 'none',
      'stroke-linecap': 'round', 'stroke-dasharray': `${c} ${c}`, 'stroke-dashoffset': c,
      transform: `rotate(-90 ${size / 2} ${size / 2})`
    });
    svg.append(arc);
    // animate in
    requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.strokeDashoffset = String(c * (1 - Math.min(v, 1))); }));
  });
  return svg;
}

/** Rings card: rings left, legend right */
export function ringsCard(items, title) {
  return h('section', { class: 'card rings-card' },
    title ? h('h3', { class: 'card-title' }, title) : null,
    h('div', { class: 'rings-row' },
      rings(items),
      h('div', { class: 'rings-legend' }, items.map((it) =>
        h('div', { class: 'rl-item' },
          h('span', { class: 'rl-label ring-text-' + it.color }, it.label),
          h('span', { class: 'rl-value' }, it.text || '–'))))));
}
