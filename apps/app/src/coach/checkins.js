// Coach: open check-ins with feedback.
import { h, card, empty, textarea, toast, showError, pageHead, tabs, clear, badge } from '../core/ui.js';
import { q, from } from '../core/db.js';
import { fmt, fmtDateTime } from '../core/dates.js';

const R = (v) => (v ? `${v}/5` : '–');

export function renderCheckinItem(c, client, onSaved, { showName = false } = {}) {
  const fb = textarea({ value: c.feedback || '', maxlength: 5000, placeholder: 'Feedback an den Kunden …', rows: 4 });
  const items = c.summary?.items || [];
  return card(null,
    h('div', { class: 'ex-head' },
      h('strong', null, showName ? h('a', { href: `#/c/kunde/${client.id}?tab=checkins` }, client.first_name, ' · ') : null, `Woche ab ${fmt(c.week_start)}`),
      c.feedback ? badge('Feedback gegeben', 'ok') : badge('offen', 'warn')),
    h('p', { class: 'muted small' }, `abgegeben ${fmtDateTime(c.submitted_at)}`),
    h('table', { class: 'kv' }, h('tbody', null,
      h('tr', null, h('th', null, 'Woche'), h('td', null, R(c.rating), c.rating_text ? ' – ' + c.rating_text : '')),
      h('tr', null, h('th', null, 'Hunger / Stress / Regeneration'), h('td', null, `${R(c.hunger)} · ${R(c.stress)} · ${R(c.recovery)}`)),
      c.difficult ? h('tr', null, h('th', null, 'Schwierig'), h('td', null, c.difficult)) : null)),
    items.length ? h('details', { open: !c.feedback }, h('summary', null, 'Wochenzusammenfassung'),
      h('table', { class: 'kv' }, h('tbody', null, items.map((i) => h('tr', null, h('th', null, i.label), h('td', null, i.value)))))) : null,
    fb,
    h('button', {
      type: 'button', onclick: async () => {
        if (!fb.value.trim()) { toast('Feedback ist leer.', 'bad'); return; }
        try { await q(from('checkins').update({ feedback: fb.value.trim() }).eq('id', c.id)); toast('Feedback gesendet – erscheint im Heute-Screen'); onSaved?.(); }
        catch (e) { showError(e); }
      }
    }, c.feedback ? 'Feedback aktualisieren' : 'Feedback senden'),
    c.feedback_seen_at ? h('p', { class: 'muted small' }, `gelesen ${fmtDateTime(c.feedback_seen_at)}`) : null);
}

export async function renderCheckins(el) {
  let filter = 'open';
  const body = h('div');
  const draw = async () => {
    clear(body);
    let qb = from('checkins').select('*, clients(id, first_name, last_name)').order('submitted_at', { ascending: false }).limit(60);
    if (filter === 'open') qb = qb.is('feedback', null);
    const list = await q(qb);
    if (!list.length) { body.append(empty(filter === 'open' ? 'Keine offenen Check-ins ' : 'Noch keine Check-ins.')); return; }
    for (const c of list) body.append(renderCheckinItem(c, c.clients, draw, { showName: true }));
  };
  const tabBar = h('div');
  const renderTabs = () => clear(tabBar).append(tabs([['open', 'Offen'], ['all', 'Alle']], filter, (v) => { filter = v; renderTabs(); draw(); }));
  renderTabs();
  el.append(pageHead('Check-ins', 'Feedback geben'), tabBar, body);
  await draw();
}
