import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

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

export function issueToken(days = 30) {
  return sign({ sub: 'owner', iat: Date.now(), exp: Date.now() + days * 864e5 });
}

/** Gibt die Sitzung zurück, oder null wenn nicht angemeldet. Wirft nichts. */
export function getAuth(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  return verify(token);
}

/** Wirft eine Response, wenn nicht autorisiert. */
export function requireAuth(req) {
  const p = getAuth(req);
  if (!p) throw json({ error: 'Nicht angemeldet' }, 401);
  return p;
}

/* ---------- Passphrase ---------- */
export function checkPassphrase(input) {
  const want = env('ADMIN_PASSPHRASE');
  const a = crypto.createHash('sha256').update(String(input ?? '')).digest();
  const b = crypto.createHash('sha256').update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ---------- Blob-Speicher ---------- */
export const store = () => getStore({ name: 'blog', consistency: 'strong' });

export async function readJSON(key, fallback = null) {
  try {
    const v = await store().get(key, { type: 'json' });
    return v ?? fallback;
  } catch { return fallback; }
}

export async function writeJSON(key, value) {
  await store().setJSON(key, value);
}

export async function deleteKey(key) {
  await store().delete(key);
}

export async function listKeys(prefix) {
  const { blobs } = await store().list({ prefix });
  return blobs.map(b => b.key);
}

/* ---------- Zähler: Ratenbegrenzung ---------- */
export async function bump(key, limit, windowKey) {
  const k = 'counter/' + key + '/' + windowKey;
  const cur = (await readJSON(k, { n: 0 })).n || 0;
  if (cur >= limit) return false;
  await writeJSON(k, { n: cur + 1, t: Date.now() });
  return true;
}

export const hourKey = () => new Date().toISOString().slice(0, 13);

/* ---------- Slugs ---------- */
export function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'artikel';
}
