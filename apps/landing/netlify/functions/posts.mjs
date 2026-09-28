import { json, bad, getAuth, requireAuth, readJSON, writeJSON, deleteKey, listKeys, slugify, store } from './_lib.mjs';
import crypto from 'node:crypto';

const MAX_BYTES = 8 * 1024 * 1024;

function publicView(post) {
  const { id, slug, title, excerpt, cover, contentHtml, publishedAt } = post;
  return { id, slug, title, excerpt, cover, contentHtml, publishedAt };
}

async function uniqueSlug(base, excludeId) {
  const keys = await listKeys('post/');
  const existing = new Set();
  for (const k of keys) {
    const p = await readJSON(k, null);
    if (p && p.id !== excludeId) existing.add(p.slug);
  }
  let slug = base;
  let n = 2;
  while (existing.has(slug)) {
    slug = base + '-' + n;
    n++;
  }
  return slug;
}

async function loadAll() {
  const keys = await listKeys('post/');
  const posts = [];
  for (const k of keys) {
    const p = await readJSON(k, null);
    if (p) posts.push(p);
  }
  posts.sort((a, b) => (b.publishedAt || b.createdAt || 0) - (a.publishedAt || a.createdAt || 0));
  return posts;
}

export default async (req) => {
  const url = new URL(req.url);
  const auth = getAuth(req);

  if (req.method === 'GET') {
    const slug = url.searchParams.get('slug');
    const id = url.searchParams.get('id');

    if (slug || id) {
      const posts = await loadAll();
      const post = posts.find(p => (slug && p.slug === slug) || (id && p.id === id));
      if (!post) return bad('Nicht gefunden', 404);
      if (!post.published && !auth) return bad('Nicht gefunden', 404);
      return json({ post: auth ? post : publicView(post) });
    }

    const posts = await loadAll();
    const visible = auth ? posts : posts.filter(p => p.published);
    return json({ posts: auth ? visible : visible.map(publicView) });
  }

  if (req.method === 'POST') {
    try { requireAuth(req); } catch (r) { return r; }
    let body;
    try { body = await req.json(); } catch { return bad('Ungültige Anfrage'); }

    const raw = JSON.stringify(body);
    if (raw.length > MAX_BYTES) return bad('Artikel zu groß (max. 8 MB, Bilder verkleinern)', 413);

    const title = String(body.title || '').trim();
    if (!title) return bad('Titel fehlt');

    const id = crypto.randomUUID();
    const slug = await uniqueSlug(slugify(body.slug || title), null);
    const now = Date.now();
    const post = {
      id,
      slug,
      title,
      excerpt: String(body.excerpt || '').slice(0, 400),
      cover: body.cover || null,
      contentHtml: String(body.contentHtml || ''),
      published: !!body.published,
      createdAt: now,
      updatedAt: now,
      publishedAt: body.publishedAt || now
    };
    await writeJSON('post/' + id, post);
    return json({ post });
  }

  if (req.method === 'PUT') {
    try { requireAuth(req); } catch (r) { return r; }
    let body;
    try { body = await req.json(); } catch { return bad('Ungültige Anfrage'); }
    if (!body.id) return bad('id fehlt');

    const raw = JSON.stringify(body);
    if (raw.length > MAX_BYTES) return bad('Artikel zu groß (max. 8 MB, Bilder verkleinern)', 413);

    const existing = await readJSON('post/' + body.id, null);
    if (!existing) return bad('Nicht gefunden', 404);

    const title = String(body.title || existing.title).trim();
    const nowPublished = body.published !== undefined ? !!body.published : existing.published;

    const updated = {
      ...existing,
      title,
      excerpt: body.excerpt !== undefined ? String(body.excerpt).slice(0, 400) : existing.excerpt,
      cover: body.cover !== undefined ? body.cover : existing.cover,
      contentHtml: body.contentHtml !== undefined ? String(body.contentHtml) : existing.contentHtml,
      published: nowPublished,
      publishedAt: body.publishedAt !== undefined ? body.publishedAt : existing.publishedAt,
      updatedAt: Date.now()
    };

    if (body.slug && slugify(body.slug) !== existing.slug) {
      updated.slug = await uniqueSlug(slugify(body.slug), existing.id);
    }

    await writeJSON('post/' + body.id, updated);
    return json({ post: updated });
  }

  if (req.method === 'DELETE') {
    try { requireAuth(req); } catch (r) { return r; }
    const id = url.searchParams.get('id');
    if (!id) return bad('id fehlt');
    await deleteKey('post/' + id);
    return json({ ok: true });
  }

  return bad('Methode nicht erlaubt', 405);
};

export const config = { path: '/api/posts' };
