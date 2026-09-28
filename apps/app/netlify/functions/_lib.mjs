// Shared helpers for the app's Netlify Functions.
// The service-role/secret key only exists here as env var SUPABASE_SERVICE_ROLE_KEY – never in the browser.
import crypto from 'node:crypto';

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
export const bad = (msg, status = 400) => json({ error: msg }, status);

export function env(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error('Umgebungsvariable fehlt: ' + name);
  }
  return v;
}

const URL_ = () => env('SUPABASE_URL').replace(/\/$/, '');

function serviceHeaders(extra = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  // new secret keys (sb_secret_...) go in apikey only; legacy JWT keys also as bearer
  const h = { apikey: key, 'content-type': 'application/json', ...extra };
  if (!key.startsWith('sb_secret_')) h.authorization = 'Bearer ' + key;
  return h;
}

async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(URL_() + path, { method, headers: serviceHeaders(headers), body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    const msg = (data && (data.msg || data.message || data.error_description || data.error)) || `Supabase ${res.status}`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = res.status;
    throw err;
  }
  return data;
}

/** PostgREST with service role (bypasses RLS – always filter explicitly!) */
export const db = {
  select: (table, query) => call(`/rest/v1/${table}?${query}`),
  insert: (table, rows, { upsert = false, onConflict } = {}) => call(`/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ''}`, {
    method: 'POST', body: rows,
    headers: { prefer: `return=representation${upsert ? ',resolution=merge-duplicates' : ''}` }
  }),
  update: (table, query, patch) => call(`/rest/v1/${table}?${query}`, { method: 'PATCH', body: patch, headers: { prefer: 'return=representation' } }),
  remove: (table, query) => call(`/rest/v1/${table}?${query}`, { method: 'DELETE' }),
  rpc: (fn, args = {}) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args })
};

export const authAdmin = {
  create: (body) => call('/auth/v1/admin/users', { method: 'POST', body }),
  update: (id, body) => call(`/auth/v1/admin/users/${id}`, { method: 'PUT', body }),
  remove: (id) => call(`/auth/v1/admin/users/${id}`, { method: 'DELETE' })
};

export const storage = {
  list: (bucket, prefix) => call(`/storage/v1/object/list/${bucket}`, { method: 'POST', body: { prefix, limit: 1000 } }),
  remove: (bucket, paths) => paths.length ? call(`/storage/v1/object/${bucket}`, { method: 'DELETE', body: { prefixes: paths } }) : null
};

function decodeJwt(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch (e) { return null; }
}

/** Verify the caller's session with Supabase Auth. Returns { user, claims, profile }. Throws Response on failure. */
export async function requireUser(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw bad('Nicht angemeldet', 401);
  const res = await fetch(URL_() + '/auth/v1/user', { headers: { apikey: env('SUPABASE_ANON_KEY', env('SUPABASE_SERVICE_ROLE_KEY')), authorization: 'Bearer ' + token } });
  if (!res.ok) throw bad('Sitzung ungültig', 401);
  const user = await res.json();
  const claims = decodeJwt(token) || {};   // signature was verified by the call above
  const profile = (await db.select('profiles', `id=eq.${user.id}&select=id,role,username,mfa_exempt`))[0];
  if (!profile) throw bad('Kein Profil', 403);
  return { user, claims, profile };
}

/** Caller must be a coach with 2FA (aal2) – test accounts with mfa_exempt excepted. */
export async function requireCoach(req) {
  const ctx = await requireUser(req);
  if (ctx.profile.role !== 'coach') throw bad('Nur für den Coach', 403);
  if (ctx.claims.aal !== 'aal2' && !ctx.profile.mfa_exempt) throw bad('Zwei-Faktor-Login erforderlich', 403);
  return ctx;
}

/** Load a client row and make sure it belongs to this coach */
export async function ownClient(coachId, clientId) {
  if (!/^[0-9a-f-]{36}$/i.test(clientId || '')) throw bad('Ungültige Kunden-ID');
  const c = (await db.select('clients', `id=eq.${clientId}&coach_id=eq.${coachId}&select=*`))[0];
  if (!c) throw bad('Kunde nicht gefunden', 404);
  return c;
}

export async function readJson(req, max = 20000) {
  const raw = await req.text();
  if (raw.length > max) throw bad('Anfrage zu groß', 413);
  try { return JSON.parse(raw || '{}'); } catch (e) { throw bad('Kein gültiges JSON'); }
}

/** Wrap a handler: thrown Responses are returned, other errors -> 500 */
export const handler = (fn) => async (req, context) => {
  try {
    if (req.method !== 'POST') return bad('Nur POST', 405);
    return await fn(req, context);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return bad(e.message || 'Serverfehler', e.status && e.status < 500 ? e.status : 500);
  }
};

/** Wrapper for scheduled functions (no request body, no user) */
export const scheduled = (name, fn) => async (req, context) => {
  try {
    const result = await fn(req, context);
    console.log(name, JSON.stringify(result));
    return json(result || { ok: true });
  } catch (e) {
    console.error(name, e);
    return bad(e.message || 'Fehler', 500);
  }
};

// ---------- AES-256-GCM for integration secrets ----------
function encKey() {
  const k = Buffer.from(env('SECRETS_ENCRYPTION_KEY'), 'base64');
  if (k.length !== 32) throw new Error('SECRETS_ENCRYPTION_KEY muss 32 Bytes (base64) lang sein');
  return k;
}
export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}
export function decrypt(blob) {
  const [v, iv, tag, data] = String(blob).split('.');
  if (v !== 'v1') throw new Error('Unbekanntes Format');
  const d = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}

/** Deterministic UUID from a string (for idempotent imports) */
export function uuidFrom(str) {
  const h = crypto.createHash('sha256').update(str).digest();
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

/** Local time in Luxembourg */
export function luxNow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Luxembourg', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hhmm: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`, weekday: wd };
}

export function minutes(hhmm) { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + m; }
