import { json, bad, requireAuth, readJSON, writeJSON } from './_lib.mjs';

const ALLOWED = new Set(['state', 'photos', 'push']);
const MAX_BYTES = 4 * 1024 * 1024;

export default async (req) => {
  try { requireAuth(req); } catch (r) { return r; }

  const url = new URL(req.url);
  const key = url.searchParams.get('key') || 'state';
  if (!ALLOWED.has(key)) return bad('Unbekannter Schlüssel');

  if (req.method === 'GET') {
    const data = await readJSON('user/' + key, null);
    return json({ key, data });
  }

  if (req.method === 'PUT') {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return bad('Datenpaket zu groß (max. 4 MB)', 413);
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return bad('Kein gültiges JSON'); }
    await writeJSON('user/' + key, parsed);
    return json({ ok: true, bytes: raw.length });
  }

  return bad('Nur GET oder PUT', 405);
};

export const config = { path: '/api/data' };
