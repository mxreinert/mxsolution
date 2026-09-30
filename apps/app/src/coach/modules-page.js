// Coach: all modules – usage, default settings, goal presets (Mehr → Module).
import { h, clear, tile, icon, toast, showError, pageHead, skeleton, scard, srow } from '../core/ui.js';
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

export async function renderModulesPage(el, app) {
  const body = h('div', null, skeleton(3));
  el.append(pageHead('Module', 'Standards für alle Kunden und Ziel-Vorlagen. Pro Kunde stellst du alles im Kunden-Tab „Module“ ein.'), body);

  const clients = await q(from('clients').select('id, status, modules, unlocks').in('status', ['active', 'maintenance', 'reduced', 'paused_sick', 'paused_other']));
  const usage = (m) => clients.filter((c) => (m.requires?.unlock ? (c.unlocks || []).includes(m.requires.unlock) : (c.modules || []).includes(m.id))).length;
  const mods = app.modules;
  const tracking = mods.filter((m) => !m.always && !m.requires?.unlock);
  const groups = [['Tracking', tracking], ['Premium', mods.filter((m) => m.requires?.unlock)], ['Werkzeuge für dich', mods.filter((m) => m.always)]];
  const wide = () => matchMedia('(min-width: 900px)').matches;
  let sel = wide() ? 'presets' : null;

  const nav = h('nav', { class: 'mods-nav', 'aria-label': 'Module' });
  const detail = h('div', { class: 'mods-detail' });
  const layout = h('div', { class: 'mods-layout' }, nav, detail);
  const link = (id, name, ic, color, count) => h('a', { href: '#', class: sel === id ? 'on' : '', onclick: (e) => { e.preventDefault(); select(id); } },
    tile(ic, color, 26), h('span', { class: 'mn-name' }, name), count != null ? h('span', { class: 'muted small' }, String(count)) : null);
  const drawNav = () => clear(nav).append(link('presets', 'Ziel-Vorlagen', 'target', 'gray'),
    groups.filter(([, l]) => l.length).map(([t, l]) => [h('div', { class: 'mn-group' }, t), l.map((m) => link(m.id, m.name, m.icon || 'grid', m.color || 'accent', m.always ? null : usage(m)))]));
  const select = (id) => { sel = id; layout.classList.toggle('detail', !!id); drawNav(); drawDetail(); };
  const back = () => h('button', { type: 'button', class: 'link-btn back-mods', onclick: () => select(null) }, icon('back', { size: 18 }), ' Alle Module');

  function drawDetail() {
    clear(detail);
    if (!sel) return;
    if (sel === 'presets') { detail.append(back(), presetsPage()); return; }
    const m = mods.find((x) => x.id === sel);
    const n = usage(m);
    const optionModule = { ...m, config: (m.config || []).filter((c) => c.store !== 'target') };
    const current = { ...Object.fromEntries(optionModule.config.map((c) => [c.key, c.default])), ...(app.rawCoachSettings?.module_defaults?.[m.id] || {}) };
    const form = configForm(optionModule, current);
    detail.append(back(),
      h('header', { class: 'mods-head' }, h('h2', null, tile(m.icon || 'grid', m.color || 'accent', 36), m.name), h('p', null, m.description || '')),
      m.always ? h('div', { class: 'mod-banner neutral' }, icon('info', { size: 20 }), h('div', { class: 'mb-text' }, 'Werkzeug für dich – immer verfügbar'))
        : h('div', { class: 'mod-banner ' + (n ? 'on' : 'neutral') }, icon(n ? 'check' : 'info', { size: 20 }),
          h('div', { class: 'mb-text' }, n ? `${n} Kunde${n === 1 ? '' : 'n'} nutz${n === 1 ? 't' : 'en'} dieses Modul` : 'Noch bei keinem Kunden aktiv',
            h('small', null, 'An- und ausschalten pro Kunde im Kunden-Tab „Module“.'))),
      m.requires?.unlock ? h('div', { class: 'warn-box' }, h('span', { class: 'wb-icon' }, icon('warning', { size: 22 })),
        h('div', null, h('strong', null, 'Premium'), h('p', null, 'Nur pro Kunde freischaltbar. Kostenpflichtige Dienste nur, wenn es im Paket enthalten ist.'))) : null,
      optionModule.config.length
        ? scard('Standard-Einstellungen', 'Gilt für alle Kunden, bei denen du nichts Eigenes eingestellt hast.', form,
          srow(null, null, h('button', {
            type: 'button', onclick: async () => {
              try {
                const defaults = { ...(app.rawCoachSettings?.module_defaults || {}), [m.id]: form.values() };
                await saveSettings(app, { module_defaults: defaults });
                toast('Standard gespeichert');
              } catch (e) { showError(e); }
            }
          }, 'Speichern')))
        : scard(null, null, srow('Keine Standard-Einstellungen', (m.config || []).length ? 'Ziele (z. B. Kalorien, Schritte) legst du pro Kunde fest.' : 'Dieses Modul hat keine Optionen.', null)));
  }

  function presetsPage() {
    const presets = structuredClone(app.rawCoachSettings?.goal_presets || {});
    const goals = Object.keys(GOALS);
    const current = (g) => new Set(presets[g] || goalModules(g, null));
    const matrix = h('table', { class: 'matrix' },
      h('thead', null, h('tr', null, h('th', null, 'Modul'), goals.map((g) => h('th', null, GOALS[g].label.split(' ')[0])))),
      h('tbody', null, tracking.map((m) => h('tr', null,
        h('td', null, m.name),
        goals.map((g) => {
          const cb = h('input', {
            type: 'checkbox', checked: current(g).has(m.id), 'aria-label': `${m.name} bei ${GOALS[g].label}`,
            onchange: () => {
              const s = current(g);
              cb.checked ? s.add(m.id) : s.delete(m.id);
              presets[g] = tracking.map((x) => x.id).filter((id) => s.has(id));
            }
          });
          return h('td', null, cb);
        })))));
    return h('div', null,
      h('header', { class: 'mods-head' }, h('h2', null, tile('target', 'gray', 36), 'Ziel-Vorlagen'),
        h('p', null, 'Welche Module beim Wählen eines Ziels vorgeschlagen werden. Bestehende Kunden ändern sich dadurch nicht.')),
      scard(null, null, h('div', { class: 'scroll-x' }, matrix),
        srow(null, null, h('button', {
          type: 'button', onclick: async () => {
            try { await saveSettings(app, { goal_presets: presets }); toast('Ziel-Vorlagen gespeichert'); } catch (e) { showError(e); }
          }
        }, 'Vorlagen speichern'))));
  }

  layout.classList.toggle('detail', !!sel);
  drawNav();
  drawDetail();
  clear(body).append(layout);
}
