// Dates are handled as local "YYYY-MM-DD" strings (device time zone = the user's day).

const pad = (n) => String(n).padStart(2, '0');

export function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function today() { return iso(new Date()); }
export function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
export function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); } // b - a
export function range(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }

/** Monday of the week containing s */
export function weekStart(s) { const d = parse(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); }

export const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function weekday(s) { return parse(s).getDay(); }

export function fmt(s, opts = {}) {
  if (!s) return '–';
  const d = typeof s === 'string' && s.length === 10 ? parse(s) : new Date(s);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: opts.year === false ? undefined : 'numeric', ...opts.extra });
}
export function fmtShort(s) { return fmt(s, { year: false }); }
export function fmtLong(s) {
  const d = parse(s);
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}
export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
export function fmtDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ' + fmtTime(ts);
}
export function relDay(s) {
  const n = diffDays(s, today());
  if (n === 0) return 'heute';
  if (n === 1) return 'gestern';
  if (n === -1) return 'morgen';
  if (n > 1 && n < 7) return `vor ${n} Tagen`;
  return fmtShort(s);
}

export function age(birthdate, at = today()) {
  if (!birthdate) return null;
  const b = parse(birthdate), a = parse(at);
  let y = a.getFullYear() - b.getFullYear();
  if (a.getMonth() < b.getMonth() || (a.getMonth() === b.getMonth() && a.getDate() < b.getDate())) y--;
  return y;
}
export function isMinor(birthdate) { const a = age(birthdate); return a !== null && a < 18; }

/** Range presets for analysis screens */
export const RANGES = [['7', '7 Tage'], ['28', '4 Wochen'], ['90', '3 Monate'], ['all', 'Alles']];
export function rangeStart(key, earliest) {
  if (key === 'all') return earliest || addDays(today(), -365);
  return addDays(today(), -(Number(key) - 1));
}
