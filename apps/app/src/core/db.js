// Thin wrapper around the Supabase client: throw on error, return data.
import { sb } from './auth.js';

export { sb };

export async function q(builder) {
  const { data, error } = await builder;
  if (error) throw error;
  return data;
}

export const from = (table) => sb.from(table);

export async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** Call one of our Netlify functions with the user's session token. */
export async function api(path, body) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch('/api/' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (session?.access_token || '') },
    body: JSON.stringify(body || {})
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* ignore */ }
  if (!res.ok) throw new Error(json?.error || `Serverfehler (${res.status})`);
  return json;
}

/** Signed URL for a private file (avatar, progress photo) */
const urlCache = new Map();
export async function fileUrl(path, seconds = 3600) {
  if (!path) return null;
  const hit = urlCache.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data, error } = await sb.storage.from('client-files').createSignedUrl(path, seconds);
  if (error) return null;
  urlCache.set(path, { url: data.signedUrl, until: Date.now() + (seconds - 60) * 1000 });
  return data.signedUrl;
}

export async function uploadFile(path, blob) {
  const { error } = await sb.storage.from('client-files').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
  if (error) throw error;
  urlCache.delete(path);
}

export async function removeFiles(paths) {
  if (!paths.length) return;
  const { error } = await sb.storage.from('client-files').remove(paths);
  if (error) throw error;
  paths.forEach((p) => urlCache.delete(p));
}
