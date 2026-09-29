// App state + context building shared by all screens.
import { q, from, rpc } from './db.js';
import { getProfile } from './auth.js';
import { mergeSettings } from './settings.js';
import { MODULES, isActive, activeModules } from './modules.js';
import { addDays, today } from './dates.js';
import { isPaused } from './goals.js';
import { refresh } from './router.js';

export const app = {
  profile: null,
  role: null,
  client: null,          // for role client: own client row (+ _settings)
  settings: mergeSettings({}),
  modules: MODULES,
  isActive: (m, client) => isActive(m, client, client?._settings, app.role),
  loadClient,
  buildCtx
};

export async function init() {
  app.profile = await getProfile();          // already loaded by the guard -> no extra request
  app.role = app.profile?.role;
  if (app.role === 'client') {
    // client row (incl. settings) and coach's public settings in parallel
    const [client, pub] = await Promise.all([loadOwnClient(), rpc('get_public_settings').catch(() => ({}))]);
    app.client = client;
    app.settings = mergeSettings(pub);
  } else if (app.role === 'coach') {
    const rows = await q(from('coach_settings').select('settings').eq('coach_id', app.profile.id));
    app.settings = mergeSettings(rows[0]?.settings);
    app.rawCoachSettings = rows[0]?.settings || {};
  }
  return app;
}

async function loadOwnClient() {
  // one request: client row with its settings row embedded
  const rows = await q(from('clients').select('*, client_settings(*)').eq('user_id', app.profile.id));
  const client = rows[0];
  if (!client) return null;
  const s = Array.isArray(client.client_settings) ? client.client_settings[0] : client.client_settings;
  delete client.client_settings;
  if (!s) {
    // first login: create settings row (fire and forget)
    q(from('client_settings').insert({ client_id: client.id })).catch(() => {});
  }
  client._settings = s || { client_id: client.id };
  return client;
}

export async function reloadOwnClient() {
  if (app.role === 'client') app.client = await loadOwnClient();
  return app.client;
}

/** Coach: load one client (+ settings) */
async function loadClient(id) {
  const rows = await q(from('clients').select('*, client_settings(*)').eq('id', id));
  const c = rows[0];
  if (!c) throw new Error('Kunde nicht gefunden');
  c._settings = (Array.isArray(c.client_settings) ? c.client_settings[0] : c.client_settings) || null;
  delete c.client_settings;
  return c;
}

/** Pause intervals from the status log -> grey bands in charts */
function pauseBands(log) {
  const bands = [];
  let start = null;
  for (const e of log) {
    const d = e.created_at.slice(0, 10);
    if (isPaused(e.status) && !start) start = d;
    else if (!isPaused(e.status) && start) { bands.push({ from: start, to: d, cls: 'pause' }); start = null; }
  }
  if (start) bands.push({ from: start, to: today(), cls: 'pause' });
  return bands;
}

/**
 * Context passed to module hooks.
 * Loads daily entries for [from - 14 days, to] (extra days for trends), status bands,
 * annotations of all active modules.
 */
async function buildCtx(client, fromDay, toDay = today(), extra = {}) {
  const role = app.role;
  const hasHevy = (client.unlocks || []).includes('hevy');
  const [daily, log, hevy] = await Promise.all([
    q(from('daily_entries').select('*').eq('client_id', client.id)
      .gte('day', addDays(fromDay, -14)).lte('day', toDay).order('day')),
    q(from('client_status_log').select('status, created_at').eq('client_id', client.id).order('created_at')),
    hasHevy ? rpc('hevy_status', { cid: client.id }).catch(() => null) : null
  ]);
  const ctx = {
    client, role, settings: app.settings, from: fromDay, to: toDay, daily,
    bands: pauseBands(log), markers: [], hints: [], hevyConnected: false,
    query: extra.query || {}, day: extra.day || today(),
    refresh: extra.refresh || (() => refresh())
  };
  const mods = activeModules(client, role);
  ctx.hevyConnected = !!hevy?.connected;
  await Promise.all(mods.filter((m) => m.annotations).map(async (m) => {
    try {
      const a = await m.annotations(ctx);
      ctx.markers.push(...(a.markers || []));
      ctx.bands.push(...(a.bands || []));
      ctx.hints.push(...(a.hints || []));
    } catch (e) { console.warn('annotations', m.id, e); }
  }));
  return ctx;
}

export { activeModules };
