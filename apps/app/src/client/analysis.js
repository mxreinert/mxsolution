// Auswertung: all active modules with the same range switch. Also used by the coach.
import { h, clear, segmented, empty, skeleton } from '../core/ui.js';
import { RANGES, rangeStart, today } from '../core/dates.js';

/** Render module analyses for a client into `body`. Shared by client and coach views. */
export async function renderAnalyses(body, app, client, { range = '28', onlyModule = null, role } = {}) {
  clear(body).append(skeleton(3));
  const fromDay = rangeStart(range, client.goal_start || client.first_contact);
  const ctx = await app.buildCtx(client, fromDay, today(), { refresh: () => renderAnalyses(body, app, client, { range, onlyModule, role }) });
  const mods = app.modules.filter((m) => m.analysis && app.isActive(m, client) && (!onlyModule || m.id === onlyModule));
  if (!mods.length) { clear(body).append(empty('Noch keine Auswertungen aktiv.')); return; }
  const nodes = await Promise.all(mods.map((m) => Promise.resolve().then(() => m.analysis(ctx))
    .catch((e) => { console.warn('analysis', m.id, e); return h('p', { class: 'error' }, `${m.name}: konnte nicht geladen werden.`); })));
  clear(body).append(nodes);
}

export async function renderAnalysis(el, app) {
  let range = sessionStorage.getItem('mx_range') || '28';
  const body = h('div');
  el.append(
    h('header', { class: 'page-head' }, h('div', null, h('h1', null, 'Auswertung'))),
    segmented(RANGES, range, (v) => { range = v; sessionStorage.setItem('mx_range', v); renderAnalyses(body, app, app.client, { range }); }),
    body);
  await renderAnalyses(body, app, app.client, { range });
}
