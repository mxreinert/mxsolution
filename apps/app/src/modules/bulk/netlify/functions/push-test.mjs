import { json, bad, requireAuth, sendPush } from './_lib.mjs';

export default async (req) => {
  try { requireAuth(req); } catch (r) { return r; }
  if (req.method !== 'POST') return bad('Nur POST', 405);

  try {
    const result = await sendPush('Bulk Cockpit', 'Testnachricht — wenn die ankommt, funktionieren die Erinnerungen.');
    if (result === 'no-vapid') return bad('Push ist serverseitig nicht konfiguriert (VAPID-Keys fehlen).', 500);
    if (result === 'no-sub') return bad('Kein Abo hinterlegt — erst "Erinnerungen aktivieren" antippen.', 400);
    if (result === 'expired') return bad('Das Abo war abgelaufen und wurde entfernt — bitte neu aktivieren.', 410);
    return json({ ok: true });
  } catch (e) {
    return bad('Push fehlgeschlagen: ' + e.message, 502);
  }
};

export const config = { path: '/api/push-test' };
