import { readJSON, sendPush } from './_lib.mjs';

/* Läuft täglich um 05:00 UTC (7:00 CEST / 6:00 CET).
   Erinnert ans Wiegen, nur wenn heute noch kein Gewicht erfasst ist. */

const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const TODAY = iso(new Date());

export default async () => {
  const S = await readJSON('user/state', null);
  if (!S) { console.log('remind-morning: kein Zustand'); return new Response('kein Zustand', { status: 200 }); }

  const today = (S.checkins || []).find(c => c.d === TODAY);
  if (today && today.weight != null) { console.log('remind-morning: Gewicht schon erfasst'); return new Response('Gewicht schon erfasst', { status: 200 }); }

  try {
    const result = await sendPush('Bulk Cockpit', 'Gewicht heute noch nicht eingetragen.');
    console.log('remind-morning: ' + result);
    return new Response(result, { status: 200 });
  } catch (e) {
    console.error('remind-morning: Push-Fehler: ' + e.message);
    return new Response('Push-Fehler: ' + e.message, { status: 500 });
  }
};

export const config = { schedule: '0 5 * * *' };
