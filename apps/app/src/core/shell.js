// App shell: guard, init, navigation, notifications, routes for client and coach.
import { guard, logout } from './auth.js';
import { app, init } from './app.js';
import { route, start, current } from './router.js';
import { h, clear, modal, empty, showError } from './ui.js';
import { q, from } from './db.js';
import { fmtDateTime } from './dates.js';
import { registerServiceWorker } from './push.js';
import { MODULES } from './modules.js';

import * as clientScreens from '../client/screens.js';
import * as coachScreens from '../coach/screens.js';

const $ = (id) => document.getElementById(id);

function applyTheme(theme) {
  const THEMES = ['light', 'dark', 'white-blue', 'black-blue'];
  if (THEMES.includes(theme)) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('mx_theme', theme); } catch (e) { /* ignore */ }
  }
}

// ---------- notifications ----------
async function unreadNotifications() {
  return q(from('notifications').select('*').eq('user_id', app.profile.id).is('read_at', null).order('created_at', { ascending: false }).limit(50));
}

async function updateBell() {
  try {
    const n = (await unreadNotifications()).length;
    $('bell-count').textContent = n > 9 ? '9+' : String(n);
    $('bell-count').hidden = !n;
  } catch (e) { /* offline */ }
}

async function markRead(ids) {
  if (!ids.length) return;
  await q(from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids));
}

async function openNotifications() {
  const list = await q(from('notifications').select('*').eq('user_id', app.profile.id).order('created_at', { ascending: false }).limit(40));
  const unread = list.filter((n) => !n.read_at).map((n) => n.id);
  modal('Benachrichtigungen', (close) => list.length ? h('div', { class: 'notif-list' }, list.map((n) =>
    h('a', { class: 'notif' + (n.read_at ? '' : ' unread'), href: n.link || '#', onclick: () => close(null) },
      h('strong', null, n.title), n.body ? h('span', null, n.body) : null,
      h('small', { class: 'muted' }, fmtDateTime(n.created_at))))) : empty('Keine Benachrichtigungen.'));
  try { await markRead(unread); } catch (e) { /* ignore */ }
  updateBell();
}

/** One-time pop-up for new unlocks / plans (client) */
async function popups() {
  const list = (await unreadNotifications()).filter((n) => ['unlock', 'plan'].includes(n.kind));
  if (!list.length) return;
  await modal(list[0].kind === 'unlock' ? '🎉 Neu für dich' : '📋 Neuer Plan', h('div', null, list.map((n) => h('p', null, h('strong', null, n.title), n.body ? ': ' + n.body : ''))), [{ label: 'Super', value: true }]);
  await markRead(list.map((n) => n.id));
  updateBell();
}

// ---------- usage statistics (client) ----------
async function logOpen() {
  try {
    const last = Number(localStorage.getItem('mx_last_open') || 0);
    if (Date.now() - last < 30 * 60e3) return;   // at most every 30 minutes
    await q(from('app_opens').insert({ client_id: app.client.id }));
    localStorage.setItem('mx_last_open', String(Date.now()));
  } catch (e) { /* offline or not allowed: ignore */ }
}

// ---------- navigation ----------
function buildNav(items) {
  const nav = $('nav');
  clear(nav);
  for (const it of items) {
    nav.append(h('a', { href: '#' + it.path, dataset: { path: it.path } }, h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, it.icon), h('span', null, it.label)));
  }
  nav.hidden = false;
}

function highlightNav(path) {
  for (const a of document.querySelectorAll('#nav a')) {
    const p = a.dataset.path;
    a.classList.toggle('on', path === p || (p !== '/c' && path.startsWith(p + '/')) || (p === '/c/kunden' && path.startsWith('/c/kunde/')));
  }
}

function registerModuleRoutes(role) {
  for (const m of MODULES) {
    for (const r of m.routes || []) {
      if (r.role !== role) continue;
      route(r.path, (el, params, query) => r.render(el, params, query, app));
    }
  }
}

async function main() {
  if (!(await guard('/home.html'))) return;
  try {
    await init();
  } catch (e) {
    $('outlet').replaceChildren(h('p', { class: 'error' }, 'App konnte nicht geladen werden. Bitte später nochmal versuchen.'), h('button', { class: 'secondary', onclick: logout }, 'Abmelden'));
    console.error(e);
    return;
  }
  $('topbar').hidden = false;
  $('bell').addEventListener('click', openNotifications);
  const setOffline = () => { $('offline').hidden = navigator.onLine; };
  window.addEventListener('online', setOffline);
  window.addEventListener('offline', setOffline);
  setOffline();
  registerServiceWorker();

  if (app.role === 'client') {
    if (!app.client) {
      $('outlet').replaceChildren(h('p', null, 'Dein Konto ist noch nicht vollständig eingerichtet. Bitte melde dich bei Max.'), h('button', { class: 'secondary', onclick: logout }, 'Abmelden'));
      return;
    }
    applyTheme(app.client._settings?.theme);
    $('brand').href = '#/heute';
    clientScreens.register(route, app);
    registerModuleRoutes('client');
    buildNav([
      { path: '/heute', label: 'Heute', icon: '🏠' },
      { path: '/training', label: 'Training', icon: '🏋️' },
      { path: '/eintragen', label: 'Eintragen', icon: '✍️' },
      { path: '/auswertung', label: 'Auswertung', icon: '📈' },
      { path: '/profil', label: 'Profil', icon: '👤' }
    ]);
    logOpen();
    for (const m of MODULES) { try { m.start?.(app); } catch (e) { /* ignore */ } }
    const home = app.client._settings?.onboarded_at ? '/heute' : '/start';
    if (!app.client._settings?.onboarded_at && !location.hash.startsWith('#/start')) location.hash = '#/start';
    await start($('outlet'), { home, changed: (path) => { highlightNav(path); $('nav').hidden = path === '/start'; updateBell(); } });
    popups().catch(showError);
  } else if (app.role === 'coach') {
    document.body.classList.add('coach');
    $('brand').href = '#/c';
    coachScreens.register(route, app);
    registerModuleRoutes('coach');
    buildNav([
      { path: '/c', label: 'Übersicht', icon: '🏠' },
      { path: '/c/kunden', label: 'Kunden', icon: '👥' },
      { path: '/c/termine', label: 'Termine', icon: '📅' },
      { path: '/c/checkins', label: 'Check-ins', icon: '✅' },
      { path: '/c/mehr', label: 'Mehr', icon: '☰' }
    ]);
    await start($('outlet'), { home: '/c', changed: (path) => { highlightNav(path); updateBell(); } });
  } else {
    await logout();
  }
  setInterval(updateBell, 120000);
}

main();

export { current };
