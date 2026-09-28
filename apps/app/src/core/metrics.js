// Aggregation helpers. Rule: averages only from existing days, never treat gaps as 0.
import { addDays, weekStart, range } from './dates.js';

export const has = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(v);

export function points(rows, key, dayKey = 'day') {
  return rows.filter((r) => has(r[key])).map((r) => ({ d: r[dayKey], v: Number(r[key]) }));
}

/** { avg, n, of } over a date window */
export function windowAvg(rows, key, from, to, dayKey = 'day') {
  const vals = rows.filter((r) => r[dayKey] >= from && r[dayKey] <= to && has(r[key])).map((r) => Number(r[key]));
  const of = range(from, to).length;
  return { avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, n: vals.length, of };
}

/** Trailing moving average per day (only days that have a value in the window) */
export function rolling(pts, days = 7) {
  const byDay = new Map(pts.map((p) => [p.d, p.v]));
  if (!pts.length) return [];
  const sorted = [...pts].sort((a, b) => (a.d < b.d ? -1 : 1));
  const out = [];
  for (const d of range(sorted[0].d, sorted[sorted.length - 1].d)) {
    const vals = range(addDays(d, -(days - 1)), d).map((x) => byDay.get(x)).filter(has);
    if (vals.length >= Math.min(3, days)) out.push({ d, v: vals.reduce((a, b) => a + b, 0) / vals.length });
  }
  return out;
}

/** Change of the 7-day average vs. the 7 days before (e.g. kg/week) */
export function weeklyChange(pts, endDay) {
  const byDay = new Map(pts.map((p) => [p.d, p.v]));
  const avg = (from, to) => {
    const v = range(from, to).map((d) => byDay.get(d)).filter(has);
    return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const now = avg(addDays(endDay, -6), endDay);
  const before = avg(addDays(endDay, -13), addDays(endDay, -7));
  return now !== null && before !== null ? now - before : null;
}

/** Group rows per week (Monday) and aggregate */
export function perWeek(rows, key, agg = 'sum', dayKey = 'day') {
  const map = new Map();
  for (const r of rows) {
    if (!has(r[key])) continue;
    const w = weekStart(r[dayKey]);
    if (!map.has(w)) map.set(w, []);
    map.get(w).push(Number(r[key]));
  }
  return [...map.entries()].sort().map(([d, vals]) => ({
    d, v: agg === 'avg' ? vals.reduce((a, b) => a + b, 0) / vals.length : vals.reduce((a, b) => a + b, 0), n: vals.length
  }));
}

/** Estimated 1RM (Epley), only up to 10 reps */
export function e1rm(weight, reps) {
  if (!has(weight) || !has(reps) || reps < 1 || reps > 10 || weight <= 0) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export function coverageText(n, of) {
  if (!of) return '';
  if (n === of) return `aus allen ${of} Tagen`;
  return `aus ${n} von ${of} Tagen`;
}

export function lastValue(rows, key, dayKey = 'day') {
  const r = [...rows].filter((x) => has(x[key])).sort((a, b) => (a[dayKey] < b[dayKey] ? 1 : -1))[0];
  return r ? { d: r[dayKey], v: Number(r[key]) } : null;
}
