// M16 Preise & Buchhaltung (coach only). No payment processing, no invoices:
// the app calculates what is due, records payments and shows income.
import { h, card, fmtEuro, empty, input, select, field, modal, toast, showError, confirmDialog, parseEuroToCents, parseNum, textarea, pageHead, tabs, clear, download, toCsv, badge } from '../../core/ui.js';
import { chart } from '../../core/chart.js';
import { kpi, kpiRow } from '../../core/metric.js';
import { q, from } from '../../core/db.js';
import { today, addDays, fmt, parse, iso } from '../../core/dates.js';

const KINDS = [['monthly', 'monatlich'], ['once', 'einmalig'], ['pt_block', 'PT-Block']];
const METHODS = [['cash', 'bar'], ['transfer', 'Überweisung'], ['other', 'sonstiges']];
const UNLOCKS = [['pt', 'Personal Training'], ['photos', 'Fotos & Umfänge'], ['hevy', 'Hevy'], ['ai', 'KI-Analyse'], ['free_training', 'Freies Training']];
const label = (list, v) => list.find(([k]) => k === v)?.[1] || v;

function addMonths(day, n) { const d = parse(day); const dd = d.getDate(); d.setMonth(d.getMonth() + n); if (d.getDate() !== dd) d.setDate(0); return iso(d); }

/** Make sure every due monthly charge exists (idempotent: unique package+due_date). */
async function ensureMonthlyCharges(clientPackages, packages) {
  const rows = [];
  for (const cp of clientPackages) {
    const p = packages.find((x) => x.id === cp.package_id);
    if (!p || p.kind !== 'monthly' || cp.status !== 'active') continue;
    const end = cp.end_date && cp.end_date < today() ? cp.end_date : today();
    for (let i = 0, due = cp.start_date; due <= end && i < 120; i++, due = addMonths(cp.start_date, i)) {
      rows.push({ client_id: cp.client_id, client_package_id: cp.id, amount_cents: Math.max(0, cp.price_cents - cp.discount_cents), due_date: due, description: `${p.name} ${fmt(due, { extra: { day: undefined } })}` });
    }
  }
  if (rows.length) await q(from('charges').upsert(rows, { onConflict: 'client_package_id,due_date', ignoreDuplicates: true }));
}

async function editPackage(p, onDone) {
  const name = input({ value: p?.name || '', maxlength: 120 });
  const kind = select(KINDS, p?.kind || 'monthly');
  const price = input({ type: 'number', step: '0.01', inputmode: 'decimal', value: p ? p.price_cents / 100 : '' });
  const units = input({ type: 'number', min: 1, max: 100, value: p?.pt_units ?? '' });
  const days = input({ type: 'number', min: 1, value: p?.duration_days ?? '', placeholder: 'optional' });
  const desc = textarea({ value: p?.description || '', maxlength: 1000 });
  const unl = new Set(p?.unlocks || []);
  const unlBox = h('div', { class: 'check-list' }, UNLOCKS.map(([k, l]) => {
    const cb = h('input', { type: 'checkbox', checked: unl.has(k), onchange: () => { cb.checked ? unl.add(k) : unl.delete(k); } });
    return h('label', { class: 'check' }, cb, h('span', null, l));
  }));
  await modal(p ? 'Paket bearbeiten' : 'Neues Paket', h('div', null,
    field('Name', name), h('div', { class: 'grid2' }, field('Art', kind), field('Preis (€)', price)),
    h('div', { class: 'grid2' }, field('PT-Einheiten (bei Block)', units), field('Laufzeit (Tage)', days)),
    field('Schaltet frei', unlBox), field('Beschreibung', desc),
    p ? h('p', { class: 'hint muted' }, 'Preisänderungen gelten nur für neue Buchungen. Bestehende Kunden behalten ihren Preis.') : null), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Speichern', onClick: async () => {
        const row = {
          name: name.value.trim(), kind: kind.value, price_cents: parseEuroToCents(price.value),
          pt_units: kind.value === 'pt_block' ? parseNum(units.value) : null, duration_days: parseNum(days.value),
          unlocks: [...unl], description: desc.value.trim() || null
        };
        if (!row.name || row.price_cents == null) { toast('Name und Preis angeben.', 'bad'); return undefined; }
        if (row.kind === 'pt_block' && !row.pt_units) { toast('Anzahl PT-Einheiten angeben.', 'bad'); return undefined; }
        try {
          if (p && p.price_cents !== row.price_cents) {
            // versioning: new row, old one inactive and pointing to the new one
            const nw = (await q(from('packages').insert(row).select()))[0];
            await q(from('packages').update({ active: false, replaced_by: nw.id }).eq('id', p.id));
          } else if (p) {
            await q(from('packages').update(row).eq('id', p.id));
          } else {
            await q(from('packages').insert(row));
          }
          toast('Paket gespeichert'); onDone?.(); return true;
        } catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

async function recordPayment(client, charges, onDone) {
  const amount = input({ type: 'number', step: '0.01', inputmode: 'decimal' });
  const date = input({ type: 'date', value: today() });
  const method = select(METHODS, 'cash');
  const openCharges = charges.filter((c) => !c.cancelled);
  const charge = select([['', '– ohne Zuordnung –'], ...openCharges.map((c) => [c.id, `${fmt(c.due_date)} · ${c.description} · ${fmtEuro(c.amount_cents)}`])], openCharges[0]?.id || '');
  charge.addEventListener('change', () => { const c = openCharges.find((x) => x.id === charge.value); if (c && !amount.value) amount.value = (c.amount_cents / 100).toFixed(2); });
  const note = input({ maxlength: 300 });
  await modal(`Zahlung von ${client.first_name}`, h('div', null,
    field('Für Forderung', charge), h('div', { class: 'grid2' }, field('Betrag (€)', amount), field('Datum', date)),
    field('Art', method), field('Notiz', note)), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Speichern', onClick: async () => {
        const cents = parseEuroToCents(amount.value);
        if (!cents || cents <= 0) { toast('Betrag eingeben.', 'bad'); return undefined; }
        try {
          await q(from('payments').insert({ client_id: client.id, charge_id: charge.value || null, amount_cents: cents, paid_on: date.value, method: method.value, note: note.value.trim() || null }));
          toast('Zahlung erfasst'); onDone?.(); return true;
        } catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

async function assignPackage(client, packages, onDone) {
  const active = packages.filter((p) => p.active);
  if (!active.length) { toast('Lege zuerst ein Paket unter „Abrechnung“ an.', 'warn'); return; }
  const pkg = select(active.map((p) => [p.id, `${p.name} · ${fmtEuro(p.price_cents)} ${label(KINDS, p.kind)}`]), active[0].id);
  const start = input({ type: 'date', value: today() });
  const discount = input({ type: 'number', step: '0.01', inputmode: 'decimal', placeholder: '0' });
  const discountNote = input({ maxlength: 200, placeholder: 'Grund, z. B. Testkunde' });
  await modal(`Paket für ${client.first_name}`, h('div', null,
    field('Paket', pkg), field('Start', start),
    h('div', { class: 'grid2' }, field('Rabatt (€)', discount), field('Rabattgrund', discountNote)),
    h('p', { class: 'hint muted' }, 'Freischaltungen des Pakets werden automatisch gesetzt. Bei PT-Blöcken wird das Guthaben gebucht.')), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Zuweisen', onClick: async () => {
        const p = active.find((x) => x.id === pkg.value);
        const disc = parseEuroToCents(discount.value) || 0;
        try {
          const endDate = p.duration_days ? addDays(start.value, p.duration_days - 1) : null;
          const cp = (await q(from('client_packages').insert({
            client_id: client.id, package_id: p.id, price_cents: p.price_cents, discount_cents: disc,
            discount_note: discountNote.value.trim() || null, start_date: start.value, end_date: endDate
          }).select()))[0];
          if (p.kind !== 'monthly') {
            await q(from('charges').insert({ client_id: client.id, client_package_id: cp.id, amount_cents: Math.max(0, p.price_cents - disc), due_date: start.value, description: p.name }));
          }
          if (p.kind === 'pt_block' && p.pt_units) {
            await q(from('pt_ledger').insert({ client_id: client.id, delta: p.pt_units, reason: 'block', note: p.name }));
          }
          if (p.unlocks.length) {
            const unlocks = [...new Set([...(client.unlocks || []), ...p.unlocks])];
            await q(from('clients').update({ unlocks }).eq('id', client.id));
          }
          toast('Paket zugewiesen'); onDone?.(); return true;
        } catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

async function clientPanel(ctx) {
  const packages = await q(from('packages').select('*'));
  const cps = await q(from('client_packages').select('*').eq('client_id', ctx.client.id).order('start_date', { ascending: false }));
  await ensureMonthlyCharges(cps, packages);
  const charges = await q(from('charges').select('*').eq('client_id', ctx.client.id).order('due_date', { ascending: false }));
  const payments = await q(from('payments').select('*').eq('client_id', ctx.client.id).order('paid_on', { ascending: false }));
  const charged = charges.filter((c) => !c.cancelled).reduce((a, c) => a + c.amount_cents, 0);
  const paid = payments.reduce((a, p) => a + p.amount_cents, 0);
  const open = charged - paid;

  const frag = document.createDocumentFragment();
  frag.append(
    card('Abrechnung',
      kpiRow(kpi('Offen', fmtEuro(open), { cls: open > 0 ? 'warn' : 'ok' }), kpi('Bezahlt gesamt', fmtEuro(paid)), kpi('Forderungen', fmtEuro(charged))),
      h('div', { class: 'row-actions wrap' },
        h('button', { type: 'button', onclick: () => recordPayment(ctx.client, charges, ctx.refresh) }, '+ Zahlung'),
        h('button', { type: 'button', class: 'secondary', onclick: () => assignPackage(ctx.client, packages, ctx.refresh) }, '+ Paket zuweisen'))),
    card('Pakete',
      cps.length ? cps.map((cp) => {
        const p = packages.find((x) => x.id === cp.package_id);
        return h('div', { class: 'list-row' },
          h('div', null, h('strong', null, p?.name || 'Paket'), ' ', badge(cp.status === 'active' ? 'aktiv' : 'beendet', cp.status === 'active' ? 'ok' : ''),
            h('div', { class: 'muted small' }, [`${fmtEuro(cp.price_cents)} ${label(KINDS, p?.kind)}`, cp.discount_cents ? `Rabatt ${fmtEuro(cp.discount_cents)}${cp.discount_note ? ' (' + cp.discount_note + ')' : ''}` : null,
              `ab ${fmt(cp.start_date)}`, cp.end_date ? `bis ${fmt(cp.end_date)}` : null].filter(Boolean).join(' · '))),
          cp.status === 'active' ? h('button', {
            type: 'button', class: 'link-btn', onclick: async () => {
              if (!await confirmDialog('Paket beenden? Ab morgen entstehen keine neuen Forderungen.')) return;
              try { await q(from('client_packages').update({ status: 'ended', end_date: today() }).eq('id', cp.id)); ctx.refresh(); } catch (e) { showError(e); }
            }
          }, 'Beenden') : null);
      }) : empty('Kein Paket zugewiesen.')),
    card('Forderungen & Zahlungen',
      [...charges.map((c) => ({ d: c.due_date, el: h('div', { class: 'list-row' + (c.cancelled ? ' faded' : '') },
        h('span', null, `${fmt(c.due_date)} · ${c.description}`),
        h('span', { class: 'row-actions' }, h('strong', null, fmtEuro(c.amount_cents)),
          !c.cancelled ? h('button', {
            type: 'button', class: 'link-btn', title: 'Stornieren', onclick: async () => {
              if (!await confirmDialog('Forderung stornieren?')) return;
              try { await q(from('charges').update({ cancelled: true }).eq('id', c.id)); ctx.refresh(); } catch (e) { showError(e); }
            }
          }, 'storno') : ' storniert')) })),
      ...payments.map((p) => ({ d: p.paid_on, el: h('div', { class: 'list-row' },
        h('span', null, `${fmt(p.paid_on)} · Zahlung (${label(METHODS, p.method)})${p.note ? ' · ' + p.note : ''}`),
        h('span', { class: 'row-actions' }, h('strong', { class: 'ok-text' }, '+' + fmtEuro(p.amount_cents)),
          h('button', {
            type: 'button', class: 'link-btn danger', onclick: async () => {
              if (!await confirmDialog('Zahlung löschen?', { ok: 'Löschen', danger: true })) return;
              try { await q(from('payments').delete().eq('id', p.id)); ctx.refresh(); } catch (e) { showError(e); }
            }
          }, '✕'))) }))]
        .sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 40).map((x) => x.el)));
  if (!charges.length && !payments.length) frag.lastChild.append(empty('Noch nichts.'));
  return frag;
}

async function renderBilling(el) {
  let tab = 'overview';
  const body = h('div');
  const draw = async () => {
    clear(body);
    const packages = await q(from('packages').select('*').order('name'));
    if (tab === 'packages') {
      body.append(h('button', { type: 'button', onclick: () => editPackage(null, draw) }, '+ Paket'),
        packages.filter((p) => p.active).length ? packages.filter((p) => p.active).map((p) => h('div', { class: 'card list-row' },
          h('div', null, h('strong', null, p.name), h('div', { class: 'muted small' },
            [`${fmtEuro(p.price_cents)} ${label(KINDS, p.kind)}`, p.pt_units ? `${p.pt_units} PT` : null, p.duration_days ? `${p.duration_days} Tage` : null,
              p.unlocks.length ? 'schaltet frei: ' + p.unlocks.map((u) => label(UNLOCKS, u)).join(', ') : null].filter(Boolean).join(' · '))),
          h('div', { class: 'row-actions' },
            h('button', { type: 'button', class: 'link-btn', onclick: () => editPackage(p, draw) }, 'Bearbeiten'),
            h('button', {
              type: 'button', class: 'link-btn danger', onclick: async () => {
                if (!await confirmDialog('Paket archivieren? Bestehende Zuweisungen bleiben.')) return;
                try { await q(from('packages').update({ active: false }).eq('id', p.id)); draw(); } catch (e) { showError(e); }
              }
            }, 'Archivieren')))) : empty('Noch keine Pakete, z. B. „Online-Coaching Monat“, „PT Einzelstunde“, „10er-Block PT“.'));
      return;
    }

    const clients = await q(from('clients').select('id, first_name, last_name, status'));
    const cps = await q(from('client_packages').select('*'));
    await ensureMonthlyCharges(cps, packages);
    const charges = await q(from('charges').select('*').eq('cancelled', false));
    const payments = await q(from('payments').select('*').order('paid_on', { ascending: false }));
    const year = new Date().getFullYear();

    if (tab === 'export') {
      const years = [...new Set(payments.map((p) => p.paid_on.slice(0, 4)))].sort().reverse();
      body.append(card('Export für Steuer/Steuerberater',
        h('p', { class: 'muted small' }, 'CSV mit allen Zahlungen eines Jahres (öffnet in Excel). Ersetzt keine offizielle Buchhaltung.'),
        years.length ? years.map((y) => h('button', {
          type: 'button', class: 'secondary', onclick: () => {
            const rows = payments.filter((p) => p.paid_on.startsWith(y)).map((p) => {
              const c = clients.find((x) => x.id === p.client_id);
              const ch = charges.find((x) => x.id === p.charge_id);
              return { Datum: p.paid_on, Kunde: c ? `${c.first_name} ${c.last_name || ''}`.trim() : '', Betrag_EUR: (p.amount_cents / 100).toFixed(2).replace('.', ','), Art: label(METHODS, p.method), Leistung: ch?.description || '', Notiz: p.note || '' };
            });
            download(`einnahmen-${y}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
          }
        }, `Einnahmen ${y} (CSV)`)) : empty('Noch keine Zahlungen.')));
      return;
    }

    // overview
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const perMonth = months.map((m) => ({ d: m + '-01', v: payments.filter((p) => p.paid_on.startsWith(m)).reduce((a, p) => a + p.amount_cents, 0) / 100 }));
    const thisMonth = perMonth[new Date().getMonth()].v;
    const yearSum = perMonth.reduce((a, m) => a + m.v, 0);
    const openBy = clients.map((c) => {
      const ch = charges.filter((x) => x.client_id === c.id).reduce((a, x) => a + x.amount_cents, 0);
      const pa = payments.filter((x) => x.client_id === c.id).reduce((a, x) => a + x.amount_cents, 0);
      return { c, open: ch - pa, paid: pa };
    });
    const openTotal = openBy.reduce((a, x) => a + Math.max(0, x.open), 0);
    const expiring = cps.filter((cp) => cp.status === 'active' && cp.end_date && cp.end_date <= addDays(today(), 14));

    body.append(
      kpiRow(kpi('Diesen Monat', fmtEuro(thisMonth * 100)), kpi(`Jahr ${year}`, fmtEuro(yearSum * 100)), kpi('Offen', fmtEuro(openTotal), { cls: openTotal ? 'warn' : 'ok' })),
      card(`Einnahmen ${year} pro Monat`, chart({ from: `${year}-01-01`, to: `${year}-12-01`, unit: '€', zero: true, series: [{ label: 'Einnahmen', points: perMonth, type: 'bar', digits: 2 }] })),
      card('Offene Beträge', openBy.filter((x) => x.open > 0).length
        ? openBy.filter((x) => x.open > 0).sort((a, b) => b.open - a.open).map((x) => h('a', { class: 'list-row card-link', href: `#/c/kunde/${x.c.id}?tab=abrechnung` },
          h('span', null, `${x.c.first_name} ${x.c.last_name || ''}`), h('strong', { class: 'warn-text' }, fmtEuro(x.open))))
        : empty('Alles bezahlt ')),
      expiring.length ? card('Läuft bald aus', expiring.map((cp) => {
        const c = clients.find((x) => x.id === cp.client_id);
        const p = packages.find((x) => x.id === cp.package_id);
        return h('a', { class: 'list-row card-link', href: `#/c/kunde/${cp.client_id}?tab=abrechnung` }, h('span', null, `${c?.first_name} · ${p?.name}`), h('span', { class: 'muted' }, fmt(cp.end_date)));
      })) : null,
      card('Umsatz pro Kunde (gesamt bezahlt)', openBy.filter((x) => x.paid > 0).sort((a, b) => b.paid - a.paid).map((x) =>
        h('div', { class: 'list-row' }, h('span', null, `${x.c.first_name} ${x.c.last_name || ''}`), h('span', null, fmtEuro(x.paid))))),
      card('Umsatz pro Paket', packages.map((p) => {
        const ids = new Set(cps.filter((cp) => cp.package_id === p.id).map((cp) => cp.id));
        const sum = payments.filter((pay) => { const ch = charges.find((c) => c.id === pay.charge_id); return ch && ids.has(ch.client_package_id); }).reduce((a, x) => a + x.amount_cents, 0);
        return sum ? h('div', { class: 'list-row' }, h('span', null, p.name), h('span', null, fmtEuro(sum))) : null;
      })));
  };
  const TABS = [['overview', 'Übersicht'], ['packages', 'Pakete'], ['export', 'Export']];
  const tabBar = h('div');
  const renderTabs = () => clear(tabBar).append(tabs(TABS, tab, (t) => { tab = t; renderTabs(); draw(); }));
  renderTabs();
  el.append(pageHead('Abrechnung', 'Nur für dich · keine Zahlungsabwicklung, keine Rechnungen'), tabBar, body);
  await draw();
}

export default {
  id: 'billing',
  name: 'Abrechnung',
  order: 98,
  icon: 'euro',
  color: 'ok',
  description: 'Pakete, Forderungen, Zahlungen und Einnahmen',
  coachOnly: true,
  always: true,
  coach: clientPanel,
  routes: [
    { path: '/c/abrechnung', role: 'coach', nav: { label: 'Abrechnung', icon: '💶' }, render: (el) => renderBilling(el) }
  ]
};

