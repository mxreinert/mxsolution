// Traffic light per client for the coach overview.
// green = enters regularly, yellow = 2–3 days nothing, red = check-in missed or several low-motivation days
import { today, addDays, diffDays, weekStart, weekday } from './dates.js';
import { isPaused } from './goals.js';

const hasData = (r) => Object.entries(r).some(([k, v]) => !['client_id', 'day', 'updated_at', 'updated_by', 'not_tracked', 'note'].includes(k) && v != null) || (r.not_tracked || []).length;

/**
 * @param client    clients row
 * @param entries   daily_entries of this client (last ~14 days)
 * @param checkins  checkins of this client (last ~3 weeks)
 * @param t         thresholds (settings)
 * @returns {level: 'ok'|'warn'|'bad'|'pause'|'none', reasons: string[]}
 */
export function ampel(client, entries, checkins, t) {
  if (isPaused(client.status)) return { level: 'pause', reasons: ['pausiert'] };
  if (!['active', 'maintenance', 'reduced'].includes(client.status) || !client.user_id) return { level: 'none', reasons: [] };
  const reasons = [];
  let level = 'ok';

  const withData = entries.filter(hasData).map((e) => e.day).sort();
  const last = withData[withData.length - 1];
  const gap = last ? diffDays(last, today()) : 99;
  if (gap >= t.ampel_red_days) { level = 'bad'; reasons.push(last ? `seit ${gap} Tagen nichts eingetragen` : 'noch nichts eingetragen'); }
  else if (gap >= t.ampel_yellow_days) { level = 'warn'; reasons.push(`seit ${gap} Tagen nichts eingetragen`); }

  // check-in of last week missed (after its due day)
  const lastWeek = addDays(weekStart(today()), -7);
  const dueOffset = (client.checkin_weekday + 6) % 7;
  const dueLastWeek = addDays(lastWeek, dueOffset);
  if (client.goal_start && client.goal_start <= dueLastWeek && !checkins.some((c) => c.week_start === lastWeek)) {
    level = 'bad'; reasons.push('Check-in letzte Woche fehlt');
  }
  // this week's check-in overdue?
  const thisDue = addDays(weekStart(today()), dueOffset);
  if (today() > thisDue && !checkins.some((c) => c.week_start === weekStart(today())) && (!client.goal_start || client.goal_start <= thisDue)) {
    if (level === 'ok') level = 'warn';
    reasons.push('Check-in diese Woche überfällig');
  }

  // low motivation streak
  const recent = entries.filter((e) => e.motivation != null).sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, t.mood_low_days);
  if (recent.length >= t.mood_low_days && recent.every((e) => e.motivation <= t.mood_low_value)) {
    level = 'bad'; reasons.push(`Motivation ${t.mood_low_days} Tage niedrig`);
  }
  return { level, reasons };
}

export const AMPEL_LABEL = { ok: 'läuft', warn: 'beobachten', bad: 'handeln', pause: 'pausiert', none: '–' };

export { weekday };
