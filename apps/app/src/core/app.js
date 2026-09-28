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
  app.profile = await getProfile();
  app.role = app.profile?.role;
  if (app.role === 'client') {
    app.client = await loadOwnClient();
    app.settings = mergeSettings(await rpc('get_public_settings'));
  } else if (app.role === 'coach') {
    const rows = await q(from('coach_settings').select('settings').eq('coach_id', app.profile.id));
    app.settings = mergeSettings(rows[0]?.settings);
    app.rawCoachSettings = rows[0]?.settings || {};
  }
  return app;
}

async function loadOwnClient() {
  const rows = await q(from('clients').select('*').eq('user_id', app.profile.id));
  const client = rows[0];
  if (!client) return null;
  const s = await q(from('client_settings').select('*').eq('client_id', client.id));
  if (!s.length) {
    // first login: create settings row
    try { await q(from('client_settings').insert({ client_id: client.id })); } catch (e) { /* ignore race */ }
  }
  client._settings = s[0] || { client_id: client.id };
  return client;
}

export async function reloadOwnClient() {
  if (app.role === 'client') app.client = await loadOwnClient();
  return app.client;
}

/** Coach: load one client (+ settings) */
async function loadClient(id) {
  const rows = await q(from('clients').select('*').eq('id', id));
  if (!rows[0]) throw new Error('Kunde nicht gefunden');
  const s = await q(from('client_settings').select('*').eq('client_id', id));
  rows[0]._settings = s[0] || null;
  return rows[0];
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
  const daily = await q(from('daily_entries').select('*').eq('client_id', client.id)
    .gte('day', addDays(fromDay, -14)).lte('day', toDay).order('day'));
  const log = await q(from('client_status_log').select('status, created_at').eq('client_id', client.id).order('created_at'));
  const ctx = {
    client, role, settings: app.settings, from: fromDay, to: toDay, daily,
    bands: pauseBands(log), markers: [], hints: [], hevyConnected: false,
    query: extra.query || {}, day: extra.day || today(),
    refresh: extra.refresh || (() => refresh())
  };
  const mods = activeModules(client, role);
  if ((client.unlocks || []).includes('hevy')) {
    try { ctx.hevyConnected = !!(await rpc('hevy_status', { cid: client.id }))?.connected; } catch (e) { /* ignore */ }
  }
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
