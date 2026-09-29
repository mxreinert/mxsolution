// Training tab: sections from modules with training() (strength, cardio, pt).
import { h, empty, skeleton, clear } from '../core/ui.js';
import { today, addDays } from '../core/dates.js';

export async function renderTraining(el, app) {
  const client = app.client;
  const mods = app.modules.filter((m) => m.training && app.isActive(m, client));
  el.append(h('header', { class: 'page-head' }, h('div', null, h('h1', null, 'Training'))));
  if (!mods.length) { el.append(empty('Max hat für dich noch kein Training eingerichtet.')); return; }
  const body = h('div', null, skeleton(2));
  el.append(body);
  const ctx = await app.buildCtx(client, addDays(today(), -30));
  const nodes = await Promise.all(mods.map((m) => Promise.resolve().then(() => m.training(ctx))
    .catch((e) => { console.warn('training', m.id, e); return h('p', { class: 'error' }, `${m.name}: konnte nicht geladen werden.`); })));
  clear(body).append(mods.map((m, i) => nodes[i]
    ? h('section', { class: 'module-section' }, mods.length > 1 ? h('h2', { class: 'section-title' }, m.name) : null, nodes[i]) : null));
}
