// Coach: "Module" tab of a client – overview + per module: on/off, premium unlock, consent,
// options (targets, evening fields …) and the module's own coach panel (plan, supplements, PT …).
import { h, clear, card, badge, tile, icon, toast, showError, confirmDialog, input, field, skeleton } from '../core/ui.js';
import { q, from } from '../core/db.js';
import { isActive } from '../core/modules.js';
import { moduleConfig, setOption, configSummary, goalModules } from '../core/modcfg.js';
import { GOALS } from '../core/goals.js';
import { today, addDays } from '../core/dates.js';
import { configForm } from './modform.js';

const CONSENT_FOR = { ai: 'ai', progress: 'photos', cycle: 'cycle' };
const CONSENT_LABEL = { ai: 'KI-Übertragung (USA)', photos: 'Fortschrittsfotos', cycle: 'Zyklus-Daten' };

function moduleState(m, client, app) {
  const active = isActive(m, client, client._settings, 'coach');
  const consentKey = CONSENT_FOR[m.id];
  const consentOk = !consentKey || !!client.extra_consents?.[consentKey];
  if (m.always) return { active: true, label: 'immer verfügbar', kind: '' };
  if (m.requires?.unlock) return active ? { active, label: 'freigeschaltet', kind: 'ok' } : { active, label: 'Premium · gesperrt', kind: '' };
  if ((client.modules || []).includes(m.id) && !consentOk) return { active: false, label: 'Einwilligung fehlt', kind: 'warn' };
  if (m.requires?.clientSetting && client._settings?.[m.requires.clientSetting] === false) return { active: false, label: 'vom Kunden ausgeschaltet', kind: 'warn' };
  return active ? { active, label: 'aktiv', kind: 'ok' } : { active, label: 'aus', kind: '' };
}

async function save(client, patch) {
  await q(from('clients').update(patch).eq('id', client.id));
  Object.assign(client, patch);
}

export async function renderModulesTab(el, app, client, { open, query, reload }) {
  const mods = app.modules;
  const openSet = new Set(open ? [open] : []);

  // ---------- overview ----------
  const states = new Map(mods.map((m) => [m.id, moduleState(m, client, app)]));
  const activeMods = mods.filter((m) => states.get(m.id).active && !m.always);
  const preset = client.goal ? goalModules(client.goal, app.rawCoachSettings) : [];
  const differs = client.goal && (preset.some((id) => !(client.modules || []).includes(id)));

  el.append(
    h('div', { class: 'overview-grid' },
      h('div', { class: 'ov-item' }, h('div', { class: 'ov-sub' }, 'Aktive Module'), h('div', { class: 'kpi-value' }, String(activeMods.length))),
      h('div', { class: 'ov-item' }, h('div', { class: 'ov-sub' }, 'Premium freigeschaltet'), h('div', { class: 'kpi-value' }, String((client.unlocks || []).length))),
      h('div', { class: 'ov-item' }, h('div', { class: 'ov-sub' }, 'Ziel'), h('div', { class: 'ov-name' }, GOALS[client.goal]?.label || 'noch offen'))),
    differs ? h('div', { class: 'hint', style: { marginBottom: '14px' } },
      `Die Vorlage für „${GOALS[client.goal].label}“ sieht weitere Module vor. `,
      h('button', {
        type: 'button', class: 'link-btn', onclick: async () => {
          if (!await confirmDialog('Module der Ziel-Vorlage zusätzlich einschalten? Bestehende bleiben an.')) return;
          try { await save(client, { modules: [...new Set([...(client.modules || []), ...preset])] }); toast('Vorlage übernommen'); reload(); } catch (e) { showError(e); }
        }
      }, 'Vorlage übernehmen')) : null);

  // ---------- groups ----------
  const groups = [
    ['Tracking', mods.filter((m) => !m.always && !m.requires?.unlock)],
    ['Premium', mods.filter((m) => m.requires?.unlock)],
    ['Werkzeuge für dich', mods.filter((m) => m.always)]
  ];

  for (const [title, list] of groups) {
    if (!list.length) continue;
    el.append(h('h4', null, title));
    const box = h('div', { class: 'list' });
    for (const m of list) box.append(moduleBlock(m));
    el.append(box);
  }

  function moduleBlock(m) {
    const st = states.get(m.id);
    const block = h('div', { class: 'mod-block' + (openSet.has(m.id) ? ' open' : '') });
    const panel = h('div', { class: 'mod-panel', hidden: !openSet.has(m.id) });
    const sub = configSummary(m, client, app.rawCoachSettings) || m.description || '';

    // on/off switch for tracking modules / premium unlock switch
    let sw = null;
    if (!m.always) {
      const on = m.requires?.unlock ? (client.unlocks || []).includes(m.requires.unlock) : (client.modules || []).includes(m.id);
      sw = h('input', {
        type: 'checkbox', checked: on, 'aria-label': m.name + ' an/aus',
        onclick: (e) => e.stopPropagation(),
        onchange: async () => {
          try {
            if (m.requires?.unlock) {
              const set = new Set(client.unlocks || []);
              sw.checked ? set.add(m.requires.unlock) : set.delete(m.requires.unlock);
              await save(client, { unlocks: [...set] });
              toast(sw.checked ? `${m.name} freigeschaltet – Kunde wird benachrichtigt` : `${m.name} gesperrt`);
            } else {
              const set = new Set(client.modules || []);
              sw.checked ? set.add(m.id) : set.delete(m.id);
              await save(client, { modules: [...set] });
              toast(sw.checked ? `${m.name} aktiviert` : `${m.name} ausgeschaltet`);
            }
            reload();
          } catch (e) { showError(e); sw.checked = !sw.checked; }
        }
      });
    }

    const row = h('div', { class: 'mod-row', role: 'button', tabindex: 0 },
      tile(m.icon || 'grid', m.color || 'accent', 32),
      h('div', { class: 'mr-body' },
        h('div', { class: 'mr-title' }, m.name, st.kind === 'warn' ? [' ', badge(st.label, 'warn')] : null),
        h('div', { class: 'mr-sub' }, sub)),
      sw,
      h('span', { class: 'mr-caret' }, icon('chevron', { size: 18 })));

    let loaded = false;
    const toggleOpen = async () => {
      const opening = panel.hidden;
      panel.hidden = !opening;
      block.classList.toggle('open', opening);
      if (opening && !loaded) { loaded = true; await fillPanel(m, panel); }
    };
    row.addEventListener('click', toggleOpen);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter') toggleOpen(); });
    block.append(row, panel);
    if (openSet.has(m.id)) { loaded = true; fillPanel(m, panel); }
    return block;
  }

  async function fillPanel(m, panel) {
    clear(panel).append(skeleton(1));
    const parts = [h('p', { class: 'muted small', style: { margin: '4px 0 0' } }, m.description || '')];

    // consent
    const consentKey = CONSENT_FOR[m.id];
    if (consentKey) {
      const d = input({ type: 'date', value: client.extra_consents?.[consentKey] || '' });
      parts.push(card(null, field(`Einwilligung ${CONSENT_LABEL[consentKey]} (Datum)`, d, 'Ohne dokumentierte Einwilligung bleibt das Modul gesperrt.'),
        h('button', {
          type: 'button', class: 'secondary', onclick: async () => {
            try { await save(client, { extra_consents: { ...(client.extra_consents || {}), [consentKey]: d.value || undefined } }); toast('Einwilligung gespeichert'); reload(); } catch (e) { showError(e); }
          }
        }, 'Einwilligung speichern')));
    }

    // options
    if (m.config?.length) {
      const form = configForm(m, moduleConfig(m, client, app.rawCoachSettings));
      parts.push(card('Einstellungen', form,
        h('button', {
          type: 'button', onclick: async () => {
            let targets = client.targets || {};
            const v = form.values();
            for (const c of m.config) targets = setOption(targets, m, c, v[c.key]);
            try { await save(client, { targets }); toast('Gespeichert'); reload(); } catch (e) { showError(e); }
          }
        }, 'Speichern')));
    }

    // the module's own coach panel (plan, supplements, PT balance …)
    if (m.coach && (isActive(m, client, client._settings, 'coach') || m.always)) {
      try {
        const ctx = await app.buildCtx(client, addDays(today(), -60), today(), { query, refresh: reload });
        const node = await m.coach(ctx);
        if (node) parts.push(h('div', { class: 'mod-coach' }, node));
      } catch (e) { console.warn('coach panel', m.id, e); parts.push(h('p', { class: 'error' }, 'Bereich konnte nicht geladen werden.')); }
    } else if (m.coach) {
      parts.push(h('p', { class: 'muted small' }, 'Aktiviere das Modul, um weitere Einstellungen zu sehen.'));
    }
    clear(panel).append(parts);
  }
}
