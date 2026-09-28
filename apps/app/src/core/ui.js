// Small DOM helpers. All text goes through textContent (no innerHTML with data).

// Screens pass arrays and conditional nulls to el.append(...) the same way as to h().
// Make the native methods behave like h(): flatten arrays, skip null/undefined/false.
for (const proto of [Element.prototype, DocumentFragment.prototype]) {
  for (const name of ['append', 'prepend', 'replaceChildren']) {
    const native = proto[name];
    if (native.__mx) continue;
    const patched = function (...args) {
      return native.apply(this, args.flat(Infinity).filter((a) => a !== null && a !== undefined && a !== false));
    };
    patched.__mx = true;
    proto[name] = patched;
  }
}

/**
 * h('div', { class: 'card', onclick: fn, dataset: {id: 1} }, 'text', child, [more])
 * Props starting with "on" become event listeners. `html` is NOT supported on purpose.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- feedback ----------
let toastTimer;
export function toast(msg, kind = 'ok') {
  let el = document.getElementById('toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status' }); document.body.append(el); }
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast ' + kind; }, 3000);
}

export function errorText(e) {
  const msg = e?.message || String(e);
  if (/row-level security|permission denied|not allowed/i.test(msg)) return 'Keine Berechtigung für diese Aktion.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Keine Verbindung. Bitte später nochmal versuchen.';
  if (/duplicate key/i.test(msg)) return 'Existiert bereits.';
  if (/violates check constraint/i.test(msg)) return 'Ein Wert liegt außerhalb des erlaubten Bereichs.';
  return msg.length < 160 ? msg : 'Etwas ist schiefgelaufen.';
}

export function showError(e) { console.error(e); toast(errorText(e), 'bad'); }

/** Modal dialog. Resolves with the value passed to close(). */
export function modal(title, body, actions = []) {
  return new Promise((resolve) => {
    const close = (v) => { overlay.remove(); document.body.classList.remove('no-scroll'); resolve(v); };
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'sheet-head' },
        h('h2', null, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Schließen', onclick: () => close(null) }, '✕')),
      h('div', { class: 'sheet-body' }, typeof body === 'function' ? body(close) : body),
      actions.length ? h('div', { class: 'sheet-actions' },
        actions.map((a) => h('button', {
          type: 'button', class: a.kind || '',
          onclick: async () => { const v = a.onClick ? await a.onClick(close) : a.value; if (v !== undefined) close(v); }
        }, a.label))) : null);
    const overlay = h('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) close(null); } }, sheet);
    document.body.append(overlay);
    document.body.classList.add('no-scroll');
  });
}

export function confirmDialog(text, { ok = 'OK', danger = false } = {}) {
  return modal('Bestätigen', h('p', null, text), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    { label: ok, kind: danger ? 'danger' : '', value: true }
  ]).then((v) => v === true);
}

// ---------- building blocks ----------
export function card(title, ...children) {
  return h('section', { class: 'card' }, title ? h('h3', { class: 'card-title' }, title) : null, children);
}

export function empty(text) { return h('p', { class: 'empty muted' }, text); }

export function loading() { return h('div', { class: 'loading', 'aria-busy': 'true' }, h('span', { class: 'spinner' }), 'Lädt …'); }

export function pageHead(title, sub, ...actions) {
  return h('header', { class: 'page-head' },
    h('div', null, h('h1', null, title), sub ? h('p', { class: 'muted' }, sub) : null),
    actions.length ? h('div', { class: 'head-actions' }, actions) : null);
}

export function backLink(href, label = 'Zurück') {
  return h('a', { class: 'back', href }, '← ', label);
}

export function field(label, input, hint) {
  const id = input.id || (input.id = 'f' + Math.random().toString(36).slice(2, 9));
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    input,
    hint ? h('small', { class: 'muted' }, hint) : null);
}

export function input(props = {}) {
  const p = { ...props };
  if (p.type === 'number') {
    p.inputmode = p.inputmode || (String(p.step || '').includes('.') ? 'decimal' : 'numeric');
  }
  return h('input', p);
}

export function textarea(props = {}) { return h('textarea', { rows: 3, ...props }); }

export function select(options, value, props = {}) {
  return h('select', props, options.map(([v, label]) =>
    h('option', { value: v, selected: String(v) === String(value ?? '') }, label)));
}

/** Tap buttons 1..max; returns element with .value */
export function rating(value, { max = 5, labels = null, onChange } = {}) {
  const wrap = h('div', { class: 'rating', role: 'radiogroup' });
  wrap.value = value ?? null;
  const render = () => {
    clear(wrap);
    for (let i = 1; i <= max; i++) {
      wrap.append(h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(wrap.value === i),
        class: wrap.value === i ? 'on' : '',
        title: labels?.[i - 1] || String(i),
        onclick: () => { wrap.value = wrap.value === i ? null : i; render(); onChange?.(wrap.value); }
      }, String(i)));
    }
  };
  render();
  return wrap;
}

/** Segmented control: options [[value,label]] */
export function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'segmented', role: 'tablist' });
  wrap.value = value;
  const render = () => {
    clear(wrap);
    for (const [v, label] of options) {
      wrap.append(h('button', {
        type: 'button', role: 'tab', 'aria-selected': String(wrap.value === v),
        class: wrap.value === v ? 'on' : '',
        onclick: () => { wrap.value = v; render(); onChange?.(v); }
      }, label));
    }
  };
  render();
  return wrap;
}

export function toggle(label, checked, onChange) {
  const cb = h('input', { type: 'checkbox', checked, onchange: () => onChange?.(cb.checked) });
  return h('label', { class: 'toggle' }, cb, h('span', null, label));
}

export function tabs(items, active, onChange) {
  return h('nav', { class: 'tabs' }, items.map(([v, label]) =>
    h('button', { type: 'button', class: v === active ? 'on' : '', onclick: () => onChange(v) }, label)));
}

export function badge(text, kind = '') { return h('span', { class: 'badge ' + kind }, text); }

export function dot(kind) { return h('span', { class: 'dot ' + kind, 'aria-hidden': 'true' }); }

// ---------- formatting ----------
const nf = (d) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
export function fmtNum(v, digits = 0) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '–';
  return nf(digits).format(Number(v));
}
export function fmtSigned(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return (v > 0 ? '+' : '') + fmtNum(v, digits);
}
export function fmtEuro(cents) {
  if (cents === null || cents === undefined) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
export function parseNum(str) {
  if (str === null || str === undefined) return null;
  const s = String(str).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
export function parseEuroToCents(str) {
  const n = parseNum(str);
  return n === null ? null : Math.round(n * 100);
}

// ---------- files ----------
export function download(filename, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  // semicolon: opens correctly in German Excel
  return '﻿' + [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n');
}

/** Resize + compress an image file to JPEG. Returns a Blob. */
export async function compressImage(file, { maxSize = 1280, quality = 0.72, square = false } = {}) {
  const bitmap = await createImageBitmap(file);
  let sw = bitmap.width, sh = bitmap.height, sx = 0, sy = 0;
  if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const canvas = h('canvas', { width: Math.round(sw * scale), height: Math.round(sh * scale) });
  canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
}

export function uuid() {
  return crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15);
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
}
