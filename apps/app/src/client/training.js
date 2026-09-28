// Training tab: sections from modules with training() (strength, cardio, pt).
import { h, empty } from '../core/ui.js';
import { today, addDays } from '../core/dates.js';

export async function renderTraining(el, app) {
  const client = app.client;
  const ctx = await app.buildCtx(client, addDays(today(), -30));
  const mods = app.modules.filter((m) => m.training && app.isActive(m, client));
  el.append(h('header', { class: 'page-head' }, h('div', null, h('h1', null, 'Training'))));
  if (!mods.length) { el.append(empty('Max hat für dich noch kein Training eingerichtet.')); return; }
  for (const m of mods) {
    try {
      const node = await m.training(ctx);
      if (node) el.append(h('section', { class: 'module-section' }, mods.length > 1 ? h('h2', { class: 'section-title' }, m.name) : null, node));
    } catch (e) { console.warn('training', m.id, e); el.append(h('p', { class: 'error' }, `${m.name}: konnte nicht geladen werden.`)); }
  }
}
