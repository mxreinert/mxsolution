// Coach: "Module" tab of a client – sidebar with all modules (desktop) / list → detail (phone).
// Detail page per module: status banner (aktiv / deaktiviert), warnings (consent …), setting cards,
// and the module's own coach panel (plan, supplements, PT …). "Allgemein" holds the per-client
// reminders and warning limits (formerly global in the coach settings).
import { h, clear, badge, tile, icon, toast, showError, confirmDialog, input, skeleton, parseNum, srow, scard, switchInput } from '../core/ui.js';
import { q, from } from '../core/db.js';
import { isActive } from '../core/modules.js';
import { moduleConfig, setOption, configSummary, goalModules } from '../core/modcfg.js';
import { GOALS } from '../core/goals.js';
import { today, addDays, isMinor } from '../core/dates.js';
import { DEFAULT_SETTINGS, clientThresholds, clientReminders } from '../core/settings.js';
import { configForm } from './modform.js';

const CONSENT_FOR = { ai: 'ai', progress: 'photos', cycle: 'cycle' };
const CONSENT_LABEL = { ai: 'KI-Übertragung (USA)', photos: 'Fortschrittsfotos', cycle: 'Zyklus-Daten' };
// extra per-client unlocks that belong to a module
const EXTRA_UNLOCKS = {
  strength: [['free_training', 'Freies Training erlauben', 'Der Kunde kann zusätzlich eigene Einheiten ohne Plan loggen.']]
};

const THRESHOLDS = [
  ['weight_delta_kg', 'Gewichtssprung', 'Hinweis beim Eintragen, wenn das Gewicht mehr als so viel vom letzten Wert abweicht.', 'kg'],
  ['kcal_min', 'Kalorien – Untergrenze', 'Werte darunter werden als möglicher Tippfehler markiert.', 'kcal'],
  ['kcal_max', 'Kalorien – Obergrenze', 'Werte darüber werden als möglicher Tippfehler markiert.', 'kcal'],
  ['steps_max', 'Schritte – Obergrenze', 'Mehr Schritte gelten als Tippfehler.', 'Schritte'],
  ['sleep_max_h', 'Schlaf – Obergrenze', 'Mehr Schlaf gilt als Tippfehler.', 'h'],
  ['set_jump_pct', 'Satzgewicht-Sprung', 'Hinweis im Trainings-Logger, wenn das Gewicht so stark vom letzten Mal abweicht.', '%'],
  ['ampel_yellow_days', 'Ampel gelb', 'Nach so vielen Tagen ohne Eintrag wird der Kunde gelb.', 'Tage'],
  ['ampel_red_days', 'Ampel rot', 'Nach so vielen Tagen ohne Eintrag wird der Kunde rot.', 'Tage'],
  ['mood_low_value', 'Motivation niedrig bis', 'Motivation (1–5) bis zu diesem Wert gilt als niedrig.', ''],
  ['mood_low_days', 'Niedrige Motivation in Folge', 'So viele Tage hintereinander niedrig → rot.', 'Tage']
];
const REMINDER_DESC = {
  weigh: 'Morgens, wenn noch kein Gewicht eingetragen ist.',
  evening: 'Abends, wenn der Abend-Check noch fehlt.',
  training: 'An Tagen mit geplantem Cardio, wenn noch nichts geloggt ist.',
  checkin: 'Am Check-in-Tag, wenn der Check-in noch fehlt.'
};

function moduleState(m, client) {
  const active = isActive(m, client, client._settings, 'coach');
  const consentKey = CONSENT_FOR[m.id];
  const consentOk = !consentKey || !!client.extra_consents?.[consentKey];
  const on = m.requires?.unlock ? (client.unlocks || []).includes(m.requires.unlock) : (client.modules || []).includes(m.id);
  const s = { active, on, consentOk, consentKey, dot: active ? 'ok' : '' };
  if (m.always) return { ...s, active: true, dot: 'ok' };
  if (on && !consentOk) s.dot = 'warn';
  if (m.requires?.clientSetting && client._settings?.[m.requires.clientSetting] === false) { s.clientOff = true; s.dot = on ? 'warn' : ''; }
  return s;
}

async function save(client, patch) {
  await q(from('clients').update(patch).eq('id', client.id));
  Object.assign(client, patch);
}

const wide = () => matchMedia('(min-width: 900px)').matches;

export async function renderModulesTab(el, app, client, { open, query, reload, onOpen }) {
  const mods = app.modules;
  let sel = open || (wide() ? 'general' : null);

  // ---------- overview ----------
  const preset = client.goal ? goalModules(client.goal, app.rawCoachSettings) : [];
  const differs = client.goal && preset.some((id) => !(client.modules || []).includes(id));
  const overview = h('div', { class: 'mods-overview' });
  const drawOverview = () => {
    const activeCount = mods.filter((m) => !m.always && moduleState(m, client).active).length;
    clear(overview).append(
      h('div', { class: 'overview-grid' },
        h('div', { class: 'ov-item' }, h('div', { class: 'ov-sub' }, 'Aktive Module'), h('div', { class: 'kpi-value' }, String(activeCount))),
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
  };

  // ---------- sidebar ----------
  const groups = [
    ['Tracking', mods.filter((m) => !m.always && !m.requires?.unlock)],
    ['Premium', mods.filter((m) => m.requires?.unlock)],
    ['Werkzeuge für dich', mods.filter((m) => m.always)]
  ];
  const nav = h('nav', { class: 'mods-nav', 'aria-label': 'Module' });
  const detail = h('div', { class: 'mods-detail' });
  const layout = h('div', { class: 'mods-layout' }, nav, detail);

  const navLink = (id, name, ic, color, dot) => h('a', {
    href: '#', class: sel === id ? 'on' : '',
    onclick: (e) => { e.preventDefault(); select(id); }
  }, tile(ic, color, 26), h('span', { class: 'mn-name' }, name), dot !== undefined ? h('span', { class: 'mn-dot ' + dot }) : null,
  wide() ? null : h('span', { class: 'mr-caret' }, icon('chevron', { size: 16 })));

  const drawNav = () => clear(nav).append(
    navLink('general', 'Allgemein', 'sliders', 'gray'),
    groups.filter(([, list]) => list.length).map(([title, list]) => [
      h('div', { class: 'mn-group' }, title),
      list.map((m) => navLink(m.id, m.name, m.icon || 'grid', m.color || 'accent', m.always ? undefined : moduleState(m, client).dot))
    ]));

  function select(id) {
    sel = id;
    onOpen?.(id);
    layout.classList.toggle('detail', !!id);
    drawNav();
    drawDetail();
    if (!wide()) window.scrollTo({ top: layout.getBoundingClientRect().top + window.scrollY - 70 });
  }

  const redraw = () => { drawOverview(); drawNav(); drawDetail(); };

  async function drawDetail() {
    clear(detail);
    if (!sel) return;
    const back = h('button', { type: 'button', class: 'link-btn back-mods', onclick: () => select(null) }, icon('back', { size: 18 }), ' Alle Module');
    if (sel === 'general') { detail.append(back, generalPage()); return; }
    const m = mods.find((x) => x.id === sel);
    if (!m) { detail.append(back, h('p', { class: 'muted' }, 'Modul nicht gefunden.')); return; }
    const body = h('div', null, skeleton(1));
    detail.append(back,
      h('header', { class: 'mods-head' }, h('h2', null, tile(m.icon || 'grid', m.color || 'accent', 36), m.name), h('p', null, m.description || '')),
      banner(m), warnings(m), body);
    clear(body).append(await moduleBody(m));
  }

  // ---------- status banner ----------
  function banner(m) {
    const st = moduleState(m, client);
    if (m.always) return h('div', { class: 'mod-banner neutral' }, icon('info', { size: 20 }), h('div', { class: 'mb-text' }, 'Immer verfügbar', h('small', null, 'Werkzeug für dich – der Kunde sieht nur, was du hier einträgst.')));
    const premium = !!m.requires?.unlock;
    const flip = async () => {
      try {
        if (premium) {
          const set = new Set(client.unlocks || []);
          st.on ? set.delete(m.requires.unlock) : set.add(m.requires.unlock);
          await save(client, { unlocks: [...set] });
          toast(st.on ? `${m.name} gesperrt` : `${m.name} freigeschaltet – Kunde wird benachrichtigt`);
        } else {
          const set = new Set(client.modules || []);
          st.on ? set.delete(m.id) : set.add(m.id);
          await save(client, { modules: [...set] });
          toast(st.on ? `${m.name} ausgeschaltet` : `${m.name} aktiviert`);
        }
        redraw();
      } catch (e) { showError(e); }
    };
    if (st.on) {
      return h('div', { class: 'mod-banner on' }, icon('check', { size: 20 }),
        h('div', { class: 'mb-text' }, premium ? 'Freigeschaltet' : 'Modul aktiv'),
        h('button', { type: 'button', onclick: flip }, premium ? 'Sperren' : 'Deaktivieren'));
    }
    return h('div', { class: 'mod-banner off' }, icon('x', { size: 20 }),
      h('div', { class: 'mb-text' }, premium ? 'Premium gesperrt' : 'Modul deaktiviert',
        h('small', null, premium ? 'Kostenpflichtig – nur freischalten, wenn es im Paket enthalten ist.' : `${client.first_name} sieht dieses Modul nicht.`)),
      h('button', { type: 'button', onclick: flip }, premium ? 'Freischalten' : 'Aktivieren'));
  }

  function warnBox(title, text) {
    return h('div', { class: 'warn-box' }, h('span', { class: 'wb-icon' }, icon('warning', { size: 22 })), h('div', null, h('strong', null, title), h('p', null, text)));
  }

  function warnings(m) {
    const st = moduleState(m, client);
    const out = [];
    if (st.consentKey && !st.consentOk) out.push(warnBox('Einwilligung fehlt', `Für ${CONSENT_LABEL[st.consentKey]} braucht es eine dokumentierte Einwilligung${isMinor(client.birthdate) ? ' der Eltern' : ''}. Bis dahin bleibt das Modul für ${client.first_name} gesperrt.`));
    if (st.clientOff) out.push(warnBox('Vom Kunden ausgeschaltet', `${client.first_name} hat diesen Bereich in den eigenen Einstellungen ausgeschaltet.`));
    if (m.id === 'hevy') out.push(warnBox('Hevy Pro nötig', 'Der Kunde braucht ein kostenpflichtiges Hevy-Pro-Abo und einen eigenen API-Schlüssel.'));
    return out;
  }

  // ---------- module detail body ----------
  async function moduleBody(m) {
    const parts = [];
    const st = moduleState(m, client);

    if (st.consentKey) {
      const d = input({ type: 'date', value: client.extra_consents?.[st.consentKey] || '' });
      parts.push(scard('Einwilligung', null,
        srow(`${CONSENT_LABEL[st.consentKey]} – Datum der Einwilligung`, 'Ohne dokumentierte Einwilligung bleibt das Modul gesperrt.', d),
        srow(null, null, h('button', {
          type: 'button', class: 'secondary', onclick: async () => {
            try { await save(client, { extra_consents: { ...(client.extra_consents || {}), [st.consentKey]: d.value || undefined } }); toast('Einwilligung gespeichert'); redraw(); } catch (e) { showError(e); }
          }
        }, 'Einwilligung speichern'))));
    }

    if (m.config?.length) {
      const form = configForm(m, moduleConfig(m, client, app.rawCoachSettings));
      parts.push(scard('Einstellungen', `Gilt nur für ${client.first_name}. ${configSummary(m, client, app.rawCoachSettings) ? 'Aktuell: ' + configSummary(m, client, app.rawCoachSettings) : ''}`,
        form,
        srow(null, null, h('button', {
          type: 'button', onclick: async () => {
            let targets = client.targets || {};
            const v = form.values();
            for (const c of m.config) targets = setOption(targets, m, c, v[c.key]);
            try { await save(client, { targets }); toast('Gespeichert'); redraw(); } catch (e) { showError(e); }
          }
        }, 'Speichern'))));
    }

    if (EXTRA_UNLOCKS[m.id]) {
      parts.push(scard('Freigaben', null, EXTRA_UNLOCKS[m.id].map(([key, title, desc]) => srow(title, desc, switchInput((client.unlocks || []).includes(key), async (v) => {
        const set = new Set(client.unlocks || []);
        v ? set.add(key) : set.delete(key);
        try { await save(client, { unlocks: [...set] }); toast(v ? 'Freigegeben' : 'Freigabe entfernt'); } catch (e) { showError(e); }
      }, title), true))));
    }

    if (m.coach && (st.active || m.always)) {
      try {
        const ctx = await app.buildCtx(client, addDays(today(), -60), today(), { query, refresh: reload });
        const node = await m.coach(ctx);
        if (node) parts.push(h('h4', null, 'Verwaltung'), h('div', { class: 'mod-coach' }, node));
      } catch (e) { console.warn('coach panel', m.id, e); parts.push(h('p', { class: 'error' }, 'Bereich konnte nicht geladen werden.')); }
    } else if (m.coach) {
      parts.push(h('p', { class: 'muted small center' }, 'Aktiviere das Modul, um Plan, Einträge und weitere Werkzeuge zu sehen.'));
    }
    if (!parts.length) parts.push(h('p', { class: 'muted small' }, 'Für dieses Modul gibt es keine weiteren Einstellungen.'));
    return parts;
  }

  // ---------- "Allgemein": reminders + warning limits for this client ----------
  function generalPage() {
    const rem = clientReminders(app.settings, client);
    const own = client._settings?.reminders || null;
    const remRows = Object.entries(rem).map(([k, r]) => {
      const time = input({ type: 'time', value: r.time || '', step: 300, class: 'mini' });
      time.addEventListener('change', () => { r.time = time.value; });
      const ownR = own?.[k];
      const desc = [REMINDER_DESC[k], ownR ? `${client.first_name} hat selbst ${ownR.on === false ? 'ausgeschaltet' : ownR.time + ' Uhr'} eingestellt.` : null].filter(Boolean).join(' ');
      return srow(DEFAULT_SETTINGS.reminders[k]?.label || r.label || k, desc,
        h('div', { class: 'unit-input' }, time, switchInput(r.on !== false, (v) => { r.on = v; }, 'an/aus')), true);
    });

    const th = clientThresholds(app.settings, client);
    const thIn = Object.fromEntries(THRESHOLDS.map(([k]) => [k, input({ type: 'number', step: 'any', inputmode: 'decimal', value: th[k] })]));

    const saveGeneral = async () => {
      const thresholds = {};
      for (const [k] of THRESHOLDS) { const v = parseNum(thIn[k].value); if (v != null) thresholds[k] = v; }
      const reminders = Object.fromEntries(Object.entries(rem).map(([k, r]) => [k, { on: r.on !== false, time: r.time }]));
      try { await save(client, { targets: { ...(client.targets || {}), thresholds, reminders } }); toast('Gespeichert'); } catch (e) { showError(e); }
    };

    return h('div', null,
      h('header', { class: 'mods-head' }, h('h2', null, tile('sliders', 'gray', 36), 'Allgemein'), h('p', null, `Einstellungen, die nur für ${client.first_name} gelten.`)),
      scard('Erinnerungen', `Push-Erinnerungen für ${client.first_name}. Stellt der Kunde im Profil selbst etwas um, gilt seine Einstellung.`, remRows),
      scard('Warngrenzen', 'Wann ein Wert als möglicher Tippfehler markiert wird und wann die Ampel umspringt.',
        THRESHOLDS.map(([k, title, desc, unit]) => srow(title, desc, h('div', { class: 'unit-input' }, thIn[k], unit ? h('span', null, unit) : null)))),
      scard('Check-in-Tag & Inaktivität', null, srow('Findest du im Tab „Konzept“', 'Dort legst du Check-in-Tag, Inaktivitäts-Hinweis und Ziel fest.', null)),
      h('button', { type: 'button', class: 'sticky-save', onclick: saveGeneral }, 'Speichern'));
  }

  drawOverview();
  layout.classList.toggle('detail', !!sel);
  drawNav();
  el.append(overview, layout);
  await drawDetail();
}

