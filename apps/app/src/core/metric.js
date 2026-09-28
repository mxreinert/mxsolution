// Shared building blocks for simple metric modules (fields in daily_entries).
import { h, fmtNum, fmtSigned, card } from './ui.js';
import { chart } from './chart.js';
import { points, rolling, windowAvg, coverageText, lastValue } from './metrics.js';
import { addDays, today, relDay } from './dates.js';

/** KPI card: big value, change, target */
export function kpi(label, value, { unit = '', sub = '', cls = '' } = {}) {
  return h('div', { class: 'kpi ' + cls },
    h('span', { class: 'kpi-label muted' }, label),
    h('span', { class: 'kpi-value' }, value, unit ? h('small', null, ' ' + unit) : null),
    sub ? h('span', { class: 'kpi-sub muted' }, sub) : null);
}

export function kpiRow(...items) { return h('div', { class: 'kpi-row' }, items); }

/**
 * Standard analysis for one daily field.
 * opts: { key, label, unit, digits, avg: true, roll: true, target, targetBand, type: 'line'|'bar', zero, extraSeries }
 */
export function metricBlock(ctx, opts) {
  const { key, label, unit = '', digits = 0, type = 'line', roll = false, target = null, zero = false } = opts;
  const rows = ctx.daily;
  const pts = points(rows, key);
  const avg7 = windowAvg(rows, key, addDays(today(), -6), today());
  const avgRange = windowAvg(rows, key, ctx.from, ctx.to);
  const last = lastValue(rows, key);

  const series = [{ label, points: pts, type, cls: roll ? 'muted' : 'accent', digits, dots: true }];
  if (roll) series.push({ label: 'Ø 7 Tage', points: rolling(pts, 7), cls: 'accent', digits, dots: false });
  if (opts.extraSeries) series.push(...opts.extraSeries);

  const band = opts.targetBand || (target != null ? { min: target * 0.95, max: target * 1.05 } : null);

  return card(label,
    kpiRow(
      kpi('Ø 7 Tage', fmtNum(avg7.avg, digits), { unit, sub: coverageText(avg7.n, avg7.of) }),
      kpi('Letzter Wert', last ? fmtNum(last.v, digits) : '–', { unit, sub: last ? relDay(last.d) : '' }),
      target != null ? kpi('Ziel', fmtNum(target, digits), { unit, sub: avg7.avg != null ? fmtSigned(avg7.avg - target, digits) + ' zum Ziel' : '' }) : null
    ),
    chart({ from: ctx.from, to: ctx.to, series, band, bands: ctx.bands, markers: ctx.markers || [], unit, zero }),
    avgRange.n && avgRange.n < avgRange.of
      ? h('p', { class: 'hint muted' }, `Durchschnitt im Zeitraum ${fmtNum(avgRange.avg, digits)} ${unit} (${coverageText(avgRange.n, avgRange.of)}${avgRange.n / avgRange.of < 0.7 ? ' – bitte vollständiger eintragen' : ''})`)
      : null
  );
}

/** Evening check number field definition helper */
export function numField(key, label, unit, opts = {}) {
  return { key, label, unit, type: opts.decimal ? 'dec' : 'int', step: opts.step || (opts.decimal ? '0.1' : '1'), min: opts.min ?? 0, max: opts.max, plaus: opts.plaus, hint: opts.hint };
}

export function ratingField(key, label, labels) {
  return { key, label, type: 'rating', labels };
}
