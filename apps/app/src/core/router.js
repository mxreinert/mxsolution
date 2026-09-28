// Minimal hash router: route('/c/kunde/:id', handler). Handler: (outlet, params, query) => cleanup?

const routes = [];
let outlet = null;
let cleanup = null;
let fallback = '/';
let onChange = null;

export function route(pattern, handler, meta = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:([a-z_]+)/gi, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
  routes.push({ pattern, re, keys, handler, meta });
}

export function current() { return (location.hash.replace(/^#/, '') || fallback).split('?')[0]; }

export function query() {
  const q = location.hash.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(q));
}

export function go(path) { location.hash = '#' + path; }

export async function render() {
  const path = current();
  const match = routes.map((r) => ({ r, m: path.match(r.re) })).find((x) => x.m);
  if (!match) { go(fallback); return; }
  const params = Object.fromEntries(match.r.keys.map((k, i) => [k, decodeURIComponent(match.m[i + 1])]));
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { /* ignore */ } }
  cleanup = null;
  onChange?.(path, match.r.meta);
  outlet.replaceChildren();
  window.scrollTo(0, 0);
  try {
    cleanup = await match.r.handler(outlet, params, query());
  } catch (e) {
    console.error(e);
    outlet.replaceChildren(Object.assign(document.createElement('p'), {
      className: 'error', textContent: 'Seite konnte nicht geladen werden: ' + (e.message || e)
    }));
  }
}

export function start(el, { home, changed } = {}) {
  outlet = el;
  fallback = home || '/';
  onChange = changed;
  window.addEventListener('hashchange', render);
  return render();
}

/** Re-render the current route (after saving etc.) */
export function refresh() { return render(); }
