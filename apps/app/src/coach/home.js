// Coach overview: what needs attention now.
import { h, card, empty, dot, badge, pageHead, showError, icon, skeleton, tile } from '../core/ui.js';
import { q, from } from '../core/db.js';
import { today, addDays, fmtDateTime, relDay } from '../core/dates.js';
import { ampel } from '../core/ampel.js';
import { STATUS } from '../core/goals.js';
import { clientThresholds } from '../core/settings.js';

const KIND_ICON = {
  pain: ['warning', 'bad'], pause: ['pause', 'gray'], pause_long: ['pause', 'warn'], return: ['check', 'ok'],
  inactive: ['clock', 'warn'], pt_low: ['people', 'indigo'], appointment: ['calendar', 'indigo'], checkin: ['checklist', 'purple'], request: ['calendar', 'accent']
};

export async function loadOverview(app) {
  const clients = await q(from('clients').select('*').order('first_name'));
  const active = clients.filter((c) => STATUS[c.status]?.group === 'client');
  const ids = active.map((c) => c.id);
  const [entries, checkins] = ids.length ? await Promise.all([
    q(from('daily_entries').select('client_id, day, weight_kg, kcal, steps, sleep_h, motivation, energy, not_tracked').in('client_id', ids).gte('day', addDays(today(), -14))),
    q(from('checkins').select('id, client_id, week_start, feedback, submitted_at').in('client_id', ids).gte('week_start', addDays(today(), -28)))
  ]) : [[], []];
  const withAmpel = active.map((c) => ({
    c, a: ampel(c, entries.filter((e) => e.client_id === c.id), checkins.filter((x) => x.client_id === c.id), clientThresholds(app.settings, c))
  }));
  return { clients, active, entries, checkins, withAmpel };
}

export function ampelRow(c, a) {
  return h('a', { class: 'list-row card-link', href: '#/c/kunde/' + c.id },
    h('div', { class: 'row-main' }, dot(a.level),
      h('div', null, h('strong', null, `${c.first_name} ${c.last_name || ''}`),
        h('div', { class: 'muted small' }, [STATUS[c.status]?.label, ...a.reasons].filter(Boolean).join(' · ')))),
    h('span', { class: 'chev' }, icon('chevron', { size: 17 })));
}

export async function renderCoachHome(el, app) {
  el.append(pageHead('Übersicht', `Hallo ${app.profile.username}`));
  const body = h('div', null, skeleton(3));
  el.append(body);
  let data, notes;
  try {
    [data, notes] = await Promise.all([
      loadOverview(app),
      q(from('notifications').select('*').eq('user_id', app.profile.id).is('read_at', null).order('created_at', { ascending: false }).limit(20))
    ]);
  } catch (e) { showError(e); return; }
  body.remove();
  const { clients, withAmpel, checkins } = data;

  const important = notes.filter((n) => ['pain', 'pause', 'return', 'inactive', 'pt_low', 'pause_long', 'appointment', 'request'].includes(n.kind));
  if (important.length) {
    el.append(card('Wichtig', important.map((n) => h('a', {
      class: 'list-row card-link', href: n.link || '#/c',
      onclick: () => { q(from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)).catch(() => {}); }
    }, h('div', { class: 'row-main' }, tile(...(KIND_ICON[n.kind] || ['info', 'accent']), 34),
      h('div', null, h('strong', null, n.title),
        h('div', { class: 'muted small' }, [n.body, fmtDateTime(n.created_at)].filter(Boolean).join(' · ')))), h('span', { class: 'chev' }, icon('chevron', { size: 17 }))))));
  }

  const openCheckins = checkins.filter((c) => !c.feedback);
  el.append(h('div', { class: 'kpi-row' },
    h('a', { class: 'kpi card-link', href: '#/c/checkins' }, h('span', { class: 'kpi-label muted' }, 'Check-ins offen'), h('span', { class: 'kpi-value' }, String(openCheckins.length))),
    h('a', { class: 'kpi card-link', href: '#/c/kunden' }, h('span', { class: 'kpi-label muted' }, 'Aktive Kunden'), h('span', { class: 'kpi-value' }, String(withAmpel.length))),
    h('a', { class: 'kpi card-link', href: '#/c/kunden?f=lead' }, h('span', { class: 'kpi-label muted' }, 'Interessenten'), h('span', { class: 'kpi-value' }, String(clients.filter((c) => c.status === 'lead' || c.status === 'concept').length)))));

  const order = { bad: 0, warn: 1, pause: 2, ok: 3, none: 4 };
  const sorted = [...withAmpel].sort((x, y) => order[x.a.level] - order[y.a.level]);
  const attention = sorted.filter((x) => x.a.level === 'bad' || x.a.level === 'warn');
  el.append(card('Braucht Aufmerksamkeit', attention.length ? attention.map((x) => ampelRow(x.c, x.a)) : empty('Alle Kunden laufen – nichts zu tun ')));

  const returns = clients.filter((c) => c.return_requested_at && (c.status === 'paused_sick' || c.status === 'paused_other'));
  if (returns.length) {
    el.append(card('Meldet sich zurück', returns.map((c) => h('a', { class: 'list-row card-link', href: '#/c/kunde/' + c.id + '?tab=konzept' },
      h('span', null, `${c.first_name} – „wieder fit“ ${relDay(c.return_requested_at.slice(0, 10))}`), badge('Status setzen', 'accent')))));
  }

  const leads = clients.filter((c) => c.status === 'discarded');
  if (leads.length) {
    el.append(card('Verworfene Interessenten', leads.map((c) => {
      const del = addDays(c.discarded_at.slice(0, 10), 45);
      return h('a', { class: 'list-row card-link', href: '#/c/kunde/' + c.id }, h('span', null, c.first_name), h('span', { class: 'muted small' }, `wird gelöscht am ${del.split('-').reverse().join('.')}`));
    })));
  }

  el.append(card('Alle aktiven Kunden', sorted.length ? sorted.map((x) => ampelRow(x.c, x.a)) : empty('Noch keine Kunden.')));
}
