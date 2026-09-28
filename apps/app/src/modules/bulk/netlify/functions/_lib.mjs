import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

/* ---------- Antworten ---------- */
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });

export const bad = (msg, status = 400) => json({ error: msg }, status);

/* ---------- Env ---------- */
export function env(name) {
  const v = process.env[name];
  if (!v) throw new Error('Umgebungsvariable fehlt: ' + name);
  return v;
}

/* ---------- Token: base64url(payload).base64url(hmac) ---------- */
const b64u = b => Buffer.from(b).toString('base64url');
const unb64u = s => Buffer.from(s, 'base64url');

function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', env('SESSION_SECRET')).update(body).digest();
  return body + '.' + b64u(mac);
}

function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  let expected;
  try {
    expected = crypto.createHmac('sha256', env('SESSION_SECRET')).update(body).digest();
  } catch { return null; }
  const given = unb64u(mac || '');
  if (given.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(given, expected)) return null;
  let p;
  try { p = JSON.parse(unb64u(body).toString('utf8')); } catch { return null; }
  if (!p || typeof p.exp !== 'number' || Date.now() > p.exp) return null;
  return p;
}

export function issueToken(days = 60) {
  return sign({ sub: 'owner', iat: Date.now(), exp: Date.now() + days * 864e5 });
}

/** Wirft eine Response, wenn nicht autorisiert. */
export function requireAuth(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const p = verify(token);
  if (!p) throw json({ error: 'Nicht angemeldet' }, 401);
  return p;
}

/* ---------- Passphrase ---------- */
export function checkPassphrase(input) {
  const want = env('APP_PASSPHRASE');
  const a = crypto.createHash('sha256').update(String(input ?? '')).digest();
  const b = crypto.createHash('sha256').update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ---------- Blob-Speicher ---------- */
export const store = () => getStore({ name: 'bulk', consistency: 'strong' });

export async function readJSON(key, fallback = null) {
  try {
    const v = await store().get(key, { type: 'json' });
    return v ?? fallback;
  } catch { return fallback; }
}

export async function writeJSON(key, value) {
  await store().setJSON(key, value);
}

/* ---------- Zähler: Ratenbegrenzung und Login-Bremse ---------- */
export async function bump(key, limit, windowKey) {
  const k = 'counter/' + key + '/' + windowKey;
  const cur = (await readJSON(k, { n: 0 })).n || 0;
  if (cur >= limit) return false;
  await writeJSON(k, { n: cur + 1, t: Date.now() });
  return true;
}

export const dayKey = () => new Date().toISOString().slice(0, 10);
export const hourKey = () => new Date().toISOString().slice(0, 13);

/* ---------- Web-Push-Erinnerungen ---------- */
const VAPID_SUBJECT = 'mailto:dieser.maxi.2023@gmail.com';

/** Schickt eine Push-Erinnerung, wenn ein Abo hinterlegt ist.
 *  Gibt zurück, was passiert ist, statt zu werfen — Scheduled Functions
 *  sollen bei fehlender Konfiguration oder abgelaufenem Abo nicht rot laufen. */
export async function sendPush(title, body) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return 'no-vapid';
  const sub = await readJSON('user/push', null);
  if (!sub) return 'no-sub';
  webpush.setVapidDetails(VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  try {
    await webpush.sendNotification(sub, JSON.stringify({ title, body }));
    return 'sent';
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      await writeJSON('user/push', null);
      return 'expired';
    }
    throw e;
  }
}
