import { json, bad, issueToken, checkPassphrase, bump, hourKey } from './_lib.mjs';

export default async (req) => {
  if (req.method !== 'POST') return bad('Nur POST', 405);

  // Höchstens 15 Login-Versuche pro Stunde, insgesamt.
  const ok = await bump('login', 15, hourKey());
  if (!ok) return bad('Zu viele Versuche. Warte eine Stunde.', 429);

  let body;
  try { body = await req.json(); } catch { return bad('Ungültige Anfrage'); }

  // Absichtliche Verzögerung: macht Rateversuche unattraktiv.
  await new Promise(r => setTimeout(r, 600));

  let valid = false;
  try { valid = checkPassphrase(body?.passphrase); }
  catch (e) { return bad('Server nicht konfiguriert: ' + e.message, 500); }

  if (!valid) return bad('Passphrase falsch', 401);
  return json({ token: issueToken(60) });
};

export const config = { path: '/api/login' };
