// Coach: client detail with tabs.
import { h, clear, card, empty, badge, dot, tabs, segmented, textarea, input, field, toast, showError, confirmDialog, backLink, fmtNum, modal, skeleton } from '../core/ui.js';
import { q, from, rpc } from '../core/db.js';
import { today, addDays, age, isMinor, fmt, fmtDateTime, RANGES, relDay } from '../core/dates.js';
import { dayGrid, chart } from '../core/chart.js';
import { STATUS, GOALS, isPaused, PAUSE_REASONS } from '../core/goals.js';
import { ampel, AMPEL_LABEL } from '../core/ampel.js';
import { renderAnalyses } from '../client/analysis.js';
import { avatarEl } from '../client/profile.js';
import { renderAnamnesis, missingRequired } from './anamnesis.js';
import { renderConcept } from './concept.js';
import { renderAccount, takeOver } from './account.js';
import { renderCheckinItem } from './checkins.js';
import { renderModulesTab } from './modules-tab.js';
import { refresh } from '../core/router.js';

export async function renderClient(el, app, params, query) {
  let client = await app.loadClient(params.id);
  const isLead = !client.user_id && ['lead', 'concept', 'discarded'].includes(client.status);
  let tab = query.tab || (isLead ? 'anamnese' : 'uebersicht');
  // old links (training, abrechnung, …) open the matching module inside the "Module" tab
  const LEGACY = { training: 'strength', supplemente: 'supplements', pt: 'pt', abrechnung: 'billing', hevy: 'hevy', ki: 'ai', bericht: 'parent_report' };
  let openModule = query.open || null;
  if (LEGACY[tab]) { openModule = LEGACY[tab]; tab = 'module'; }

  const allTabs = isLead
    ? [['anamnese', 'Anamnese'], ['konzept', 'Konzept'], ['module', 'Module'], ['notizen', 'Notizen'], ['konto', 'Übernehmen']]
    : [['uebersicht', 'Übersicht'], ['module', 'Module'], ['auswertung', 'Auswertung'], ['checkins', 'Check-ins'],
      ['konzept', 'Konzept'], ['anamnese', 'Anamnese'], ['notizen', 'Notizen'], ['konto', 'Konto & Daten']];
  if (!allTabs.some(([k]) => k === tab)) tab = allTabs[0][0];

  const body = h('div');
  const tabBar = h('div', { class: 'tab-scroll' });
  // full re-render (header, tabs and status may change, e.g. after "Als Kunde übernehmen")
  const reload = () => refresh();

  const header = h('header', { class: 'page-head profile-head' }, await avatarEl(client.id, 56),
    h('div', null,
      h('h1', null, `${client.first_name} ${client.last_name || ''}`),
      h('p', { class: 'muted' }, [STATUS[client.status]?.label, client.birthdate ? `${age(client.birthdate)} J.` : null, GOALS[client.goal]?.label].filter(Boolean).join(' · ')),
      isMinor(client.birthdate) ? badge(client.parent_consent_at ? `minderjährig · Elterneinwilligung vom ${fmt(client.parent_consent_at)}` : 'minderjährig · Elterneinwilligung fehlt', client.parent_consent_at ? '' : 'warn') : null,
      client.phone ? h('div', { class: 'row-actions' },
        h('a', { class: 'link-btn', href: `tel:${client.phone}` }, 'Anrufen'),
        h('a', { class: 'link-btn', href: `https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`, target: '_blank', rel: 'noopener noreferrer' }, 'WhatsApp')) : null));

  const renderTabs = () => clear(tabBar).append(tabs(allTabs, tab, (t) => {
    tab = t; renderTabs();
    history.replaceState(null, '', `#/c/kunde/${client.id}?tab=${t}`);
    draw();
  }));

  const moduleCtx = async (extraQuery = {}) => app.buildCtx(client, addDays(today(), -60), today(), { query: { ...query, ...extraQuery }, refresh: reload });

  const draw = async () => {
    clear(body).append(skeleton(2));
    const frag = document.createDocumentFragment();
    try {
      if (tab === 'uebersicht') await overview(frag, app, client, reload);
      else if (tab === 'konzept') renderConcept(frag, client, reload);
      else if (tab === 'anamnese') {
        renderAnamnesis(frag, client, reload);
        if (isLead) frag.append(h('button', { type: 'button', class: 'secondary', onclick: () => { tab = 'konto'; renderTabs(); draw(); } }, 'Weiter: als Kunde übernehmen →'));
      } else if (tab === 'auswertung') {
        let range = '28';
        const out = h('div');
        frag.append(segmented(RANGES, range, (v) => { range = v; renderAnalyses(out, app, client, { range }); }), out);
        renderAnalyses(out, app, client, { range });
      } else if (tab === 'module') {
        await renderModulesTab(frag, app, client, { open: openModule, query, reload });
      } else if (tab === 'checkins') {
        const list = await q(from('checkins').select('*').eq('client_id', client.id).order('week_start', { ascending: false }).limit(20));
        if (!list.length) frag.append(empty('Noch keine Check-ins.'));
        for (const c of list) frag.append(renderCheckinItem(c, client, reload));
      } else if (tab === 'notizen') {
        await notes(frag, client);
      } else if (tab === 'konto') {
        await renderAccount(frag, client, reload);
      }
    } catch (e) { showError(e); frag.append(h('p', { class: 'error' }, 'Konnte nicht geladen werden.')); }
    clear(body).append(frag);
  };

  renderTabs();
  el.append(backLink('#/c/kunden', 'Kunden'), header, tabBar, body);
  await draw();
}

async function overview(frag, app, client, reload) {
  const entries = await q(from('daily_entries').select('*').eq('client_id', client.id).gte('day', addDays(today(), -30)).order('day'));
  const checkins = await q(from('checkins').select('*').eq('client_id', client.id).order('week_start', { ascending: false }).limit(4));
  const opens = await q(from('app_opens').select('opened_at').eq('client_id', client.id).gte('opened_at', new Date(Date.now() - 30 * 864e5).toISOString()).order('opened_at', { ascending: false }));
  const a = ampel(client, entries.filter((e) => e.day >= addDays(today(), -14)), checkins, app.settings.thresholds);
  const openDays = new Set(opens.map((o) => new Date(o.opened_at).toISOString().slice(0, 10)));
  const entryDays = new Set(entries.filter((e) => Object.entries(e).some(([k, v]) => !['client_id', 'day', 'updated_at', 'updated_by', 'not_tracked'].includes(k) && v != null)).map((e) => e.day));
  const hours = entries.filter((e) => e.updated_at).map((e) => new Date(e.updated_at).getHours()).sort((x, y) => x - y);
  const typicalHour = hours.length ? hours[Math.floor(hours.length / 2)] : null;
  const miss = missingRequired(client);

  // status + quick actions
  frag.append(card('Status',
    h('p', null, dot(a.level), ' ', h('strong', null, AMPEL_LABEL[a.level]), a.reasons.length ? h('span', { class: 'muted' }, ' – ' + a.reasons.join(', ')) : null),
    isPaused(client.status) ? h('p', null, '', PAUSE_REASONS.find(([k]) => k === client.status_reason)?.[1] || 'Pause', client.status_detail ? ` · ${client.status_detail}` : '', client.status_until ? ` · bis ${fmt(client.status_until)}` : '', ` · seit ${relDay(client.status_since.slice(0, 10))}`) : null,
    client.return_requested_at ? h('p', { class: 'ok-text' }, 'Meldet sich zurück – Status im Konzept setzen.') : null,
    client.plan_review_at && client.plan_review_at <= addDays(today(), 7) ? h('p', { class: 'warn-text' }, `Konzept überarbeiten fällig am ${fmt(client.plan_review_at)}`) : null,
    miss.length ? h('p', { class: 'warn-text small' }, `Anamnese: ${miss.length} Pflichtfeld(er) offen`) : null,
    h('div', { class: 'row-actions wrap' },
      h('button', { type: 'button', class: 'secondary', onclick: () => sendMessage(client) }, 'Nachricht senden'),
      !client.user_id ? h('button', { type: 'button', onclick: () => takeOver(client, reload) }, 'Als Kunde übernehmen') : null)));

  // usage
  frag.append(card('Nutzung (30 Tage)',
    h('p', { class: 'muted small' }, 'App geöffnet'), dayGrid(addDays(today(), -29), today(), (d) => openDays.has(d)),
    h('p', { class: 'muted small' }, 'Tage mit Einträgen'), dayGrid(addDays(today(), -29), today(), (d) => entryDays.has(d)),
    h('p', { class: 'muted small' }, [
      `${openDays.size} Tage geöffnet`, `${entryDays.size} Tage mit Einträgen`,
      typicalHour != null ? `übliche Eintragszeit ~${typicalHour} Uhr` : null,
      opens[0] ? `zuletzt ${fmtDateTime(opens[0].opened_at)}` : 'noch nie geöffnet'
    ].filter(Boolean).join(' · '))));

  // emergency contact
  const e = client.emergency || {};
  if (e.name || e.phone) {
    frag.append(card('Notfallkontakt',
      h('p', null, h('strong', null, e.name || '?'), e.relation ? ` (${e.relation})` : ''),
      e.phone ? h('a', { class: 'button danger small', href: `tel:${e.phone}` }, '', e.phone) : null,
      e.notes ? h('p', { class: 'hint' }, e.notes) : null));
  }

  // latest values
  const last = [...entries].reverse().find((x) => x.weight_kg != null || x.kcal != null);
  if (last) {
    frag.append(card('Letzte Werte (' + relDay(last.day) + ')', h('table', { class: 'kv' }, h('tbody', null,
      [['weight_kg', 'Gewicht', 'kg', 1], ['kcal', 'kcal', '', 0], ['protein_g', 'Protein', 'g', 0], ['steps', 'Schritte', '', 0], ['sleep_h', 'Schlaf', 'h', 1], ['motivation', 'Motivation', '/5', 0]]
        .filter(([k]) => last[k] != null).map(([k, l, u, d]) => h('tr', null, h('th', null, l), h('td', null, `${fmtNum(last[k], d)} ${u}`))))),
    last.note ? h('p', { class: 'hint' }, '„', last.note, '“') : null));
    const w = entries.filter((x) => x.weight_kg != null).map((x) => ({ d: x.day, v: Number(x.weight_kg) }));
    if (w.length > 2) frag.append(card('Gewicht 30 Tage', chart({ from: addDays(today(), -29), to: today(), unit: 'kg', series: [{ label: 'Gewicht', points: w, cls: 'accent', digits: 1 }] })));
  }
  if (checkins[0]) frag.append(h('div', null, h('h3', { class: 'section-title' }, 'Letzter Check-in'), renderCheckinItem(checkins[0], client, reload)));
}

async function sendMessage(client) {
  const title = input({ maxlength: 200, placeholder: 'z. B. Stark gemacht diese Woche!' });
  const body = textarea({ maxlength: 2000 });
  await modal(`Nachricht an ${client.first_name}`, h('div', null, field('Titel', title), field('Text (optional)', body),
    h('p', { class: 'muted small' }, 'Erscheint im Heute-Screen und als Push. Für Gespräche bleibt WhatsApp der Hauptkanal.')), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Senden', onClick: async () => {
        if (!title.value.trim()) { toast('Titel fehlt.', 'bad'); return undefined; }
        try { await rpc('coach_send_message', { cid: client.id, p_title: title.value.trim(), p_body: body.value.trim() || null }); toast('Gesendet'); return true; }
        catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

async function notes(frag, client) {
  const list = await q(from('client_notes').select('*').eq('client_id', client.id).order('created_at', { ascending: false }));
  const ta = textarea({ maxlength: 5000, placeholder: 'Notiz nur für dich …' });
  const listEl = h('div');
  const drawList = (rows) => listEl.replaceChildren(...(rows.length ? rows.map((n) => h('div', { class: 'card' },
    h('p', { class: 'prewrap' }, n.body),
    h('div', { class: 'row-actions' }, h('small', { class: 'muted' }, fmtDateTime(n.created_at)),
      h('button', {
        type: 'button', class: 'link-btn danger', onclick: async () => {
          if (!await confirmDialog('Notiz löschen?', { ok: 'Löschen', danger: true })) return;
          try { await q(from('client_notes').delete().eq('id', n.id)); drawList(rows.filter((x) => x.id !== n.id)); } catch (e) { showError(e); }
        }
      }, 'Löschen')))) : [empty('Noch keine Notizen.')]));
  drawList(list);
  frag.append(card('Neue Notiz (nur für dich sichtbar)', ta,
    h('button', {
      type: 'button', onclick: async () => {
        if (!ta.value.trim()) return;
        try { const row = (await q(from('client_notes').insert({ client_id: client.id, body: ta.value.trim() }).select()))[0]; list.unshift(row); ta.value = ''; drawList(list); }
        catch (e) { showError(e); }
      }
    }, 'Speichern')), listEl);
}
