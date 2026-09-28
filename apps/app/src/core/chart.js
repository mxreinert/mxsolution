// One chart component for all modules (plain SVG, no library).
// Gaps are never drawn as 0: a missing day breaks the line.
import { h } from './ui.js';
import { diffDays, range, fmtShort, parse } from './dates.js';
import { fmtNum } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, v);
  kids.flat().forEach((k) => k && el.append(k));
  return el;
};

/**
 * chart({
 *   from, to,                         // 'YYYY-MM-DD'
 *   series: [{ label, points: [{d, v}], type: 'line'|'bar'|'dots', cls: 'accent'|'muted'|'ok'|..., digits }],
 *   band: {min, max},                 // green target band
 *   bands: [{from, to, cls: 'pause'|'cycle'}],
 *   markers: [{d, label}],
 *   height: 180, unit: 'kg', zero: false
 * })
 */
export function chart(opts) {
  const { from, to, series = [], band, bands = [], markers = [], height = 180, unit = '', zero = false } = opts;
  const W = 340, H = height, padL = 36, padR = 8, padT = 10, padB = 22;
  const days = Math.max(1, diffDays(from, to));
  const x = (d) => padL + (diffDays(from, d) / days) * (W - padL - padR);

  const values = series.flatMap((se) => se.points.map((p) => p.v)).filter((v) => v !== null && v !== undefined);
  if (band) { if (band.min != null) values.push(band.min); if (band.max != null) values.push(band.max); }
  if (!values.length) return h('div', { class: 'chart-empty muted' }, 'Noch keine Daten in diesem Zeitraum.');

  let min = Math.min(...values), max = Math.max(...values);
  if (zero || series.some((se) => se.type === 'bar')) min = Math.min(0, min);
  if (min === max) { min -= 1; max += 1; }
  const padV = (max - min) * 0.08;
  if (!(zero || series.some((se) => se.type === 'bar'))) min -= padV;
  max += padV;
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', preserveAspectRatio: 'none' });

  // background bands (pause, cycle)
  for (const b of bands) {
    const bf = b.from < from ? from : b.from, bt = !b.to || b.to > to ? to : b.to;
    if (bf > to || bt < from) continue;
    svg.append(s('rect', { x: x(bf), y: padT, width: Math.max(2, x(bt) - x(bf)), height: H - padT - padB, class: 'band-' + (b.cls || 'pause') }));
  }
  // target band
  if (band && (band.min != null || band.max != null)) {
    const top = y(band.max ?? max), bottom = y(band.min ?? min);
    svg.append(s('rect', { x: padL, y: top, width: W - padL - padR, height: Math.max(1, bottom - top), class: 'band-target' }));
  }

  // grid + y labels (3 lines)
  for (let i = 0; i <= 2; i++) {
    const v = min + ((max - min) * i) / 2;
    svg.append(s('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: 'grid' }));
    svg.append(s('text', { x: padL - 4, y: y(v) + 3, class: 'axis', 'text-anchor': 'end' }, document.createTextNode(fmtNum(v, max - min < 10 ? 1 : 0))));
  }
  // x labels: start, middle, end
  for (const d of [from, range(from, to)[Math.floor(days / 2)], to]) {
    if (!d) continue;
    svg.append(s('text', { x: x(d), y: H - 6, class: 'axis', 'text-anchor': d === from ? 'start' : d === to ? 'end' : 'middle' }, document.createTextNode(fmtShort(d))));
  }

  // series
  const barSeries = series.filter((se) => se.type === 'bar');
  const barW = Math.max(2, Math.min(18, ((W - padL - padR) / (days + 1)) * 0.7 / Math.max(1, barSeries.length)));
  series.forEach((se) => {
    const pts = se.points.filter((p) => p.v !== null && p.v !== undefined && p.d >= from && p.d <= to)
      .sort((a, b) => (a.d < b.d ? -1 : 1));
    const cls = se.cls || 'accent';
    if (se.type === 'bar') {
      const bi = barSeries.indexOf(se);
      for (const p of pts) {
        const top = y(Math.max(0, p.v)), base = y(0);
        svg.append(s('rect', { x: x(p.d) - (barW * barSeries.length) / 2 + bi * barW, y: top, width: barW - 1, height: Math.max(1, base - top), class: 'bar ' + cls, rx: 2 }));
      }
      return;
    }
    // split into segments at gaps > maxGap days
    const maxGap = se.maxGap ?? 1;
    let seg = [];
    const flush = () => {
      if (seg.length > 1) svg.append(s('polyline', { points: seg.map((p) => `${x(p.d)},${y(p.v)}`).join(' '), class: 'line ' + cls + (se.dashed ? ' dashed' : '') }));
      seg = [];
    };
    pts.forEach((p, i) => {
      if (i && diffDays(pts[i - 1].d, p.d) > maxGap) flush();
      seg.push(p);
    });
    flush();
    if (se.type === 'dots' || se.dots !== false) {
      for (const p of pts) svg.append(s('circle', { cx: x(p.d), cy: y(p.v), r: se.type === 'dots' ? 2.6 : 1.8, class: 'pt ' + cls }));
    }
  });

  for (const m of markers) {
    if (m.d < from || m.d > to) continue;
    svg.append(s('line', { x1: x(m.d), x2: x(m.d), y1: padT, y2: H - padB, class: 'marker' }));
    svg.append(s('text', { x: x(m.d) + 3, y: padT + 9, class: 'axis marker-label' }, document.createTextNode(m.label)));
  }

  // tap/hover readout
  const readout = h('div', { class: 'chart-readout muted' }, ' ');
  const wrap = h('div', { class: 'chart-wrap' }, svg, readout);
  const onPoint = (clientX) => {
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const dayIdx = Math.round(((px - padL) / (W - padL - padR)) * days);
    const d = range(from, to)[Math.max(0, Math.min(days, dayIdx))];
    const parts = series.map((se) => {
      const p = se.points.find((q) => q.d === d);
      return p && p.v != null ? `${se.label ? se.label + ': ' : ''}${fmtNum(p.v, se.digits ?? 1)}${unit ? ' ' + unit : ''}` : null;
    }).filter(Boolean);
    readout.textContent = fmtShort(d) + ' · ' + (parts.length ? parts.join(' · ') : 'kein Eintrag');
  };
  svg.addEventListener('pointermove', (e) => onPoint(e.clientX));
  svg.addEventListener('pointerdown', (e) => onPoint(e.clientX));
  if (series.length > 1) {
    wrap.append(h('div', { class: 'legend' }, series.map((se) => h('span', { class: 'legend-item ' + (se.cls || 'accent') }, se.label))));
  }
  return wrap;
}

/** Small progress ring / bar for percentages (0..1) */
export function meter(fraction, cls = 'accent') {
  const f = Math.max(0, Math.min(1, fraction || 0));
  return h('div', { class: 'meter', role: 'meter', 'aria-valuenow': Math.round(f * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('div', { class: 'meter-fill ' + cls, style: { width: (f * 100).toFixed(1) + '%' } }));
}

/** Day grid (e.g. 30 days of usage / entries) */
export function dayGrid(from, to, isOn, { title } = {}) {
  return h('div', { class: 'daygrid', title: title || '' },
    range(from, to).map((d) => h('span', {
      class: 'cell ' + (isOn(d) ? 'on' : ''),
      title: fmtShort(d)
    })));
}

export { parse };
