// Coach: all modules – usage, default settings, goal presets (Mehr → Module).
import { h, clear, card, tile, icon, badge, toast, showError, pageHead, modal, skeleton } from '../core/ui.js';
import { q, from } from '../core/db.js';
import { GOALS } from '../core/goals.js';
import { goalModules } from '../core/modcfg.js';
import { mergeSettings } from '../core/settings.js';
import { configForm } from './modform.js';

async function saveSettings(app, patch) {
  const settings = { ...(app.rawCoachSettings || {}), ...patch };
  await q(from('coach_settings').upsert({ coach_id: app.profile.id, settings }, { onConflict: 'coach_id' }));
  app.rawCoachSettings = settings;
  app.settings = mergeSettings(settings);
}

async function editDefaults(app, m, onDone) {
  const current = { ...Object.fromEntries((m.config || []).map((c) => [c.key, c.default])), ...(app.rawCoachSettings?.module_defaults?.[m.id] || {}) };
  // targets (store: 'target') are per client – defaults only for options
  const optionModule = { ...m, config: (m.config || []).filter((c) => c.store !== 'target') };
  const form = configForm(optionModule, current);
  await modal(m.name, h('div', null,
    h('p', { class: 'muted small' }, 'Standard für alle Kunden. Einzelne Kunden kannst du im Tab „Module“ abweichend einstellen.'),
    form), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Speichern', onClick: async () => {
        try {
          const defaults = { ...(app.rawCoachSettings?.module_defaults || {}), [m.id]: form.values() };
          await saveSettings(app, { module_defaults: defaults });
          toast('Standard gespeichert'); onDone?.(); return true;
        } catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

export async function renderModulesPage(el, app) {
  const body = h('div', null, skeleton(3));
  el.append(pageHead('Module', 'Was deine Kunden tracken – Standards und Ziel-Vorlagen'), body);

  const draw = async () => {
    const clients = await q(from('clients').select('id, status, modules, unlocks').in('status', ['active', 'maintenance', 'reduced', 'paused_sick', 'paused_other']));
    const usage = (m) => clients.filter((c) => (m.requires?.unlock ? (c.unlocks || []).includes(m.requires.unlock) : (c.modules || []).includes(m.id))).length;
    const mods = app.modules;
    const tracking = mods.filter((m) => !m.always && !m.requires?.unlock);
    const premium = mods.filter((m) => m.requires?.unlock);
    const tools = mods.filter((m) => m.always);

    const row = (m) => {
      const n = usage(m);
      const optionCount = (m.config || []).filter((c) => c.store !== 'target').length;
      return h('div', { class: 'mod-row', role: 'button', tabindex: 0, onclick: () => (optionCount ? editDefaults(app, m, draw) : null) },
        tile(m.icon || 'grid', m.color || 'accent', 32),
        h('div', { class: 'mr-body' },
          h('div', { class: 'mr-title' }, m.name),
          h('div', { class: 'mr-sub' }, m.description || '')),
        m.always ? badge('Werkzeug') : badge(`${n} Kunde${n === 1 ? '' : 'n'}`, n ? 'accent' : ''),
        optionCount ? h('span', { class: 'mr-caret' }, icon('chevron', { size: 18 })) : null);
    };

    // goal presets matrix
    const presets = structuredClone(app.rawCoachSettings?.goal_presets || {});
    const goals = Object.keys(GOALS);
    const current = (g) => new Set(presets[g] || goalModules(g, null));
    const matrix = h('table', { class: 'matrix' },
      h('thead', null, h('tr', null, h('th', null, 'Modul'), goals.map((g) => h('th', null, GOALS[g].label.split(' ')[0])))),
      h('tbody', null, tracking.map((m) => h('tr', null,
        h('td', null, m.name),
        goals.map((g) => {
          const set = current(g);
          const cb = h('input', {
            type: 'checkbox', checked: set.has(m.id), 'aria-label': `${m.name} bei ${GOALS[g].label}`,
            onchange: () => {
              const s = current(g);
              cb.checked ? s.add(m.id) : s.delete(m.id);
              presets[g] = tracking.map((x) => x.id).filter((id) => s.has(id));
            }
          });
          return h('td', null, cb);
        })))));

    clear(body).append(
      h('h4', null, 'Tracking'), h('div', { class: 'list' }, tracking.map(row)),
      h('h4', null, 'Premium (pro Kunde freischaltbar)'), h('div', { class: 'list' }, premium.map(row)),
      h('h4', null, 'Werkzeuge für dich'), h('div', { class: 'list' }, tools.map(row)),
      card('Ziel-Vorlagen',
        h('p', { class: 'muted small' }, 'Welche Module beim Wählen eines Ziels vorgeschlagen werden. Bestehende Kunden ändern sich dadurch nicht.'),
        h('div', { class: 'scroll-x' }, matrix),
        h('button', {
          type: 'button', onclick: async () => {
            try { await saveSettings(app, { goal_presets: presets }); toast('Ziel-Vorlagen gespeichert'); } catch (e) { showError(e); }
          }
        }, 'Vorlagen speichern')));
  };
  await draw();
}
