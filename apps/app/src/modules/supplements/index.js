// M17 Supplemente (incl. M13 Kreatin as special supplement)
import { h, card, fmtNum, input, select, field, toggle, modal, confirmDialog, toast, showError, empty, parseNum, textarea } from '../../core/ui.js';
import { q, from } from '../../core/db.js';
import { meter } from '../../core/chart.js';
import { addDays, today, diffDays, fmt, range } from '../../core/dates.js';

const UNITS = ['g', 'mg', 'µg', 'IE', 'ml', 'Kapseln', 'Tabletten', 'Portion'];
const TIMINGS = [['any', 'egal'], ['morning', 'morgens'], ['noon', 'mittags'], ['evening', 'abends'], ['pre', 'vor dem Training'], ['post', 'nach dem Training']];
const timingLabel = (t) => TIMINGS.find(([k]) => k === t)?.[1] || '';

const activeOn = (s, day) => s.started_on <= day && (!s.ended_on || s.ended_on >= day);

async function loadSupplements(clientId) {
  return q(from('supplements').select('*').eq('client_id', clientId).order('created_at'));
}

async function loadLogs(clientId, fromDay, toDay) {
  return q(from('supplement_logs').select('*').eq('client_id', clientId).gte('day', fromDay).lte('day', toDay));
}

function supplementForm(s = {}, { coach }) {
  const f = {
    name: input({ value: s.name || '', maxlength: 80, placeholder: 'z. B. Kreatin, Vitamin D' }),
    dose: input({ type: 'number', step: '0.01', value: s.dose ?? '' }),
    unit: select(UNITS.map((u) => [u, u]), s.unit || 'g'),
    timing: select(TIMINGS, s.timing || 'any'),
    started: input({ type: 'date', value: s.started_on || today() }),
    note: textarea({ value: s.note || '', maxlength: 500 }),
    creatine: null
  };
  let isCreatine = !!s.is_creatine;
  const el = h('div', null,
    field('Name', f.name),
    h('div', { class: 'grid2' }, field('Dosis', f.dose), field('Einheit', f.unit)),
    field('Zeitpunkt', f.timing),
    field('Seit', f.started),
    coach ? toggle('Ist Kreatin (Beginn wird in der Gewichtsgrafik markiert)', isCreatine, (v) => { isCreatine = v; }) : null,
    field('Notiz', f.note));
  el.values = () => ({
    name: f.name.value.trim(),
    dose: parseNum(f.dose.value),
    unit: f.unit.value,
    timing: f.timing.value,
    started_on: f.started.value || today(),
    note: f.note.value.trim() || null,
    ...(coach ? { is_creatine: isCreatine || /kreatin|creatin/i.test(f.name.value) } : {})
  });
  return el;
}

async function editSupplement(ctx, s, onDone) {
  const coach = ctx.role === 'coach';
  const form = supplementForm(s || {}, { coach });
  await modal(s ? 'Supplement bearbeiten' : 'Supplement hinzufügen', form, [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Speichern',
      onClick: async () => {
        const v = form.values();
        if (!v.name) { toast('Bitte einen Namen eingeben.', 'bad'); return undefined; }
        try {
          if (s) await q(from('supplements').update(v).eq('id', s.id));
          else await q(from('supplements').insert({ ...v, client_id: ctx.client.id, added_by_client: !coach }));
          toast('Gespeichert');
          onDone?.();
          return true;
        } catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

export default {
  id: 'supplements',
  name: 'Supplemente',
  order: 70,

  /** creatine start -> marker + water hint in weight chart */
  async annotations(ctx) {
    const list = await loadSupplements(ctx.client.id);
    const creatine = list.filter((s) => s.is_creatine);
    const out = { markers: [], hints: [] };
    for (const s of creatine) {
      out.markers.push({ d: s.started_on, label: 'Kreatin' });
      const days = diffDays(s.started_on, today());
      if (days >= 0 && days <= 21) {
        out.hints.push({ for: 'weight', text: `Kreatin seit ${days} Tagen: In den ersten 1–3 Wochen sind +1–2 kg Wasser normal und kein Fett.` });
      }
    }
    return out;
  },

  /** section in the evening check */
  async evening(ctx) {
    const list = (await loadSupplements(ctx.client.id)).filter((s) => activeOn(s, ctx.day));
    if (!list.length) return null;
    const logs = await loadLogs(ctx.client.id, ctx.day, ctx.day);
    const rows = list.map((s) => {
      const log = logs.find((l) => l.supplement_id === s.id);
      const cb = h('input', { type: 'checkbox', checked: log?.taken ?? false });
      const amount = input({ type: 'number', step: '0.01', value: log?.amount ?? s.dose ?? '', 'aria-label': 'Menge ' + s.name, class: 'small' });
      return {
        s, cb, amount, touched: !!log,
        el: h('div', { class: 'supp-row' },
          h('label', { class: 'check' }, cb, h('span', null, s.name, s.timing && s.timing !== 'any' ? h('small', { class: 'muted' }, ' · ' + timingLabel(s.timing)) : null)),
          h('span', { class: 'supp-amount' }, amount, h('small', { class: 'muted' }, ' ' + (s.unit || ''))))
      };
    });
    rows.forEach((r) => { r.cb.addEventListener('change', () => { r.touched = true; }); r.amount.addEventListener('input', () => { r.touched = true; r.cb.checked = true; }); });
    return {
      el: h('fieldset', { class: 'evening-section' }, h('legend', null, '💊 Supplemente'), rows.map((r) => r.el)),
      async save(day) {
        const upserts = rows.filter((r) => r.touched).map((r) => ({
          client_id: ctx.client.id, supplement_id: r.s.id, day,
          taken: r.cb.checked, amount: r.cb.checked ? parseNum(r.amount.value) : null
        }));
        if (upserts.length) await q(from('supplement_logs').upsert(upserts, { onConflict: 'supplement_id,day' }));
      }
    };
  },

  async analysis(ctx) {
    const list = await loadSupplements(ctx.client.id);
    const logs = await loadLogs(ctx.client.id, ctx.from, ctx.to);
    const wrap = card('Supplemente');
    if (!list.length) wrap.append(empty('Keine Supplemente eingetragen.'));
    for (const s of list) {
      const days = range(s.started_on > ctx.from ? s.started_on : ctx.from, s.ended_on && s.ended_on < ctx.to ? s.ended_on : ctx.to);
      const taken = logs.filter((l) => l.supplement_id === s.id && l.taken && days.includes(l.day)).length;
      const frac = days.length ? taken / days.length : 0;
      wrap.append(h('div', { class: 'macro' },
        h('div', { class: 'macro-head' },
          h('span', null, s.name, s.is_creatine ? ' (Kreatin)' : '', s.ended_on ? h('small', { class: 'muted' }, ` · beendet ${fmt(s.ended_on)}`) : null),
          h('span', { class: 'muted' }, `${taken}/${days.length} Tage · ${fmtNum(frac * 100)} %`)),
        meter(frac, frac >= 0.8 ? 'ok' : 'accent'),
        h('small', { class: 'muted' }, [s.dose != null ? `${fmtNum(s.dose, 2)} ${s.unit || ''}` : null, timingLabel(s.timing), `seit ${fmt(s.started_on)}`, s.added_by_client ? 'selbst eingetragen' : null].filter(Boolean).join(' · '))));
    }
    if (ctx.role === 'client') {
      wrap.append(h('button', { type: 'button', class: 'secondary', onclick: () => editSupplement(ctx, null, ctx.refresh) }, '+ Eigenes Supplement eintragen'));
      wrap.append(h('p', { class: 'hint muted' }, 'Max sieht selbst eingetragene Supplemente. Bei Medikamenten oder Unsicherheit bitte ärztlich abklären.'));
    }
    return wrap;
  },

  /** coach panel in client detail */
  async coach(ctx) {
    const list = await loadSupplements(ctx.client.id);
    const wrap = card('Supplemente verwalten');
    if (!list.length) wrap.append(empty('Noch keine Supplemente.'));
    for (const s of list) {
      wrap.append(h('div', { class: 'list-row' },
        h('div', null, h('strong', null, s.name), s.is_creatine ? ' 🧪' : '',
          h('div', { class: 'muted small' }, [s.dose != null ? `${fmtNum(s.dose, 2)} ${s.unit || ''}` : null, timingLabel(s.timing), `seit ${fmt(s.started_on)}`, s.ended_on ? `bis ${fmt(s.ended_on)}` : null, s.added_by_client ? 'vom Kunden' : null].filter(Boolean).join(' · '))),
        h('div', { class: 'row-actions' },
          h('button', { type: 'button', class: 'link-btn', onclick: () => editSupplement(ctx, s, ctx.refresh) }, 'Bearbeiten'),
          !s.ended_on ? h('button', {
            type: 'button', class: 'link-btn', onclick: async () => {
              try { await q(from('supplements').update({ ended_on: today() }).eq('id', s.id)); ctx.refresh(); } catch (e) { showError(e); }
            }
          }, 'Beenden') : null,
          h('button', {
            type: 'button', class: 'link-btn danger', onclick: async () => {
              if (!await confirmDialog(`„${s.name}“ inkl. aller Einträge löschen?`, { ok: 'Löschen', danger: true })) return;
              try { await q(from('supplements').delete().eq('id', s.id)); ctx.refresh(); } catch (e) { showError(e); }
            }
          }, 'Löschen'))));
    }
    wrap.append(h('button', { type: 'button', class: 'secondary', onclick: () => editSupplement(ctx, null, ctx.refresh) }, '+ Supplement hinzufügen'));
    return wrap;
  },

  async summary(ctx, fromDay, toDay) {
    const list = (await loadSupplements(ctx.client.id)).filter((s) => activeOn(s, toDay));
    if (!list.length) return [];
    const logs = await loadLogs(ctx.client.id, fromDay, toDay);
    const n = range(fromDay, toDay).length;
    return list.map((s) => ({ label: s.name, value: `${logs.filter((l) => l.supplement_id === s.id && l.taken).length}/${n} Tage` }));
  }
};

export { activeOn, addDays };
