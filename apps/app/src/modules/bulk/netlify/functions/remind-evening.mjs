import { readJSON, sendPush } from './_lib.mjs';

/* Läuft täglich um 19:00 UTC (21:00 CEST / 20:00 CET).
   Erinnert ans Kalorien-Eintragen, wenn heute noch keine da sind,
   meldet ein überfälliges Wochen-Review dazu, und stupst sonntags
   zum Datenexport an. */

const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const TODAY = iso(new Date());
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

export default async () => {
  const S = await readJSON('user/state', null);
  if (!S) { console.log('remind-evening: kein Zustand'); return new Response('kein Zustand', { status: 200 }); }

  const lines = [];

  const today = (S.checkins || []).find(c => c.d === TODAY);
  if (!today || today.kcal == null) lines.push('Kalorien heute noch nicht eingetragen.');

  const lastWeekReview = (S.reviews || [])
    .filter(r => r.type === 'week')
    .sort((a, b) => (a.d < b.d ? -1 : 1))
    .pop();
  const sessionCount = (S.sessions || []).length;
  if (sessionCount >= 3 && (!lastWeekReview || days(lastWeekReview.d, TODAY) >= 9))
    lines.push('Wochen-Review ist fällig.');

  if (new Date().getUTCDay() === 0) lines.push('Sonntag: Daten exportieren nicht vergessen.');

  if (!lines.length) { console.log('remind-evening: nichts zu melden'); return new Response('nichts zu melden', { status: 200 }); }

  try {
    const result = await sendPush('Bulk Cockpit', lines.join(' '));
    console.log('remind-evening: ' + result);
    return new Response(result, { status: 200 });
  } catch (e) {
    console.error('remind-evening: Push-Fehler: ' + e.message);
    return new Response('Push-Fehler: ' + e.message, { status: 500 });
  }
};

export const config = { schedule: '0 19 * * *' };
