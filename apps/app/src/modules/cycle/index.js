// M14 Zyklus: start and end date of the period (nothing else). Explicit consent required.
// The client can switch the module off and delete all entries herself.
import { h, card, fmtNum, confirmDialog, toast, showError, empty, input, field, fcard } from '../../core/ui.js';
import { q, from } from '../../core/db.js';
import { addDays, today, diffDays, fmt } from '../../core/dates.js';

async function loadStarts(clientId) {
  return q(from('cycle_entries').select('start_date, end_date').eq('client_id', clientId).order('start_date'));
}

function avgLength(starts) {
  const diffs = [];
  for (let i = 1; i < starts.length; i++) {
    const d = diffDays(starts[i - 1].start_date, starts[i].start_date);
    if (d >= 18 && d <= 45) diffs.push(d);
  }
  return diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;
}

/** Average period length in days (only periods with an end date) */
function avgPeriod(starts) {
  const l = starts.filter((s) => s.end_date).map((s) => diffDays(s.start_date, s.end_date) + 1).filter((d) => d >= 1 && d <= 15);
  return l.length ? l.reduce((a, b) => a + b, 0) / l.length : null;
}

/** Current state: running period, day of cycle, next expected start */
function cycleState(starts, day = today()) {
  const past = starts.filter((s) => s.start_date <= day);
  const last = past[past.length - 1];
  if (!last) return null;
  const len = Math.round(avgLength(starts) || 28);
  const running = !last.end_date && diffDays(last.start_date, day) <= 14 ? last : null;
  const next = addDays(last.start_date, len);
  return { last, running, len, cycleDay: diffDays(last.start_date, day) + 1, next, inDays: diffDays(day, next) };
}

export default {
  id: 'cycle',
  name: 'Zyklus',
  order: 80,
  icon: 'drop',
  color: 'pink',
  description: 'Periodenbeginn – erklärt Gewichtsschwankungen (nur mit Einwilligung)',
  requires: { consent: 'cycle', clientSetting: 'cycle_enabled' },

  /** shade the first 5 days of each cycle and the expected pre-menstrual days in charts */
  async annotations(ctx) {
    const starts = await loadStarts(ctx.client.id);
    const len = Math.round(avgLength(starts) || 28);
    const bands = [];
    for (const s of starts) {
      bands.push({ from: s.start_date, to: s.end_date || addDays(s.start_date, 4), cls: 'cycle' });
      bands.push({ from: addDays(s.start_date, len - 5), to: addDays(s.start_date, len - 1), cls: 'cycle-pre' });
    }
    return { bands, hints: starts.length ? [{ for: 'weight', text: 'Hinterlegte Tage: Periode und Tage davor – hier sind Wassereinlagerungen von 1–2 kg typisch.' }] : [] };
  },

  async evening(ctx) {
    const starts = await loadStarts(ctx.client.id);
    const st = cycleState(starts, ctx.day);
    const already = starts.some((s) => s.start_date === ctx.day);
    const endsHere = starts.some((s) => s.end_date === ctx.day);
    // a period is running on this day -> offer "ended", otherwise "started"
    const ending = st?.running && st.running.start_date < ctx.day && !already;
    let mark = false;
    const labels = ending
      ? ['Periode ist an diesem Tag zu Ende', '✓ Periode zu Ende']
      : ['Periode hat an diesem Tag begonnen', '✓ Periode hat begonnen'];
    const done = already ? '✓ Periodenbeginn eingetragen' : endsHere ? '✓ Periodenende eingetragen' : null;
    const btn = h('button', {
      type: 'button', class: 'secondary' + (done ? ' on' : ''), disabled: !!done,
      onclick: () => { mark = !mark; btn.classList.toggle('on', mark); btn.textContent = mark ? labels[1] : labels[0]; }
    }, done || labels[0]);
    return {
      el: h('fieldset', { class: 'evening-section' }, h('legend', null, 'Zyklus'),
        st?.running && !done ? h('p', { class: 'muted small' }, `Periode seit ${fmt(st.running.start_date)} (Tag ${diffDays(st.running.start_date, ctx.day) + 1})`) : null, btn),
      async save(day) {
        if (!mark || done) return;
        if (ending) await q(from('cycle_entries').update({ end_date: day }).eq('client_id', ctx.client.id).eq('start_date', st.running.start_date));
        else await q(from('cycle_entries').insert({ client_id: ctx.client.id, start_date: day }));
      }
    };
  },

  async today(ctx) {
    if (ctx.role !== 'client') return null;
    const st = cycleState(await loadStarts(ctx.client.id));
    if (!st) return null;
    const sub = st.running ? `Periode · Tag ${st.cycleDay} – Ende im Abend-Check eintragen`
      : st.inDays > 1 ? `Zyklustag ${st.cycleDay} · nächste Periode in ca. ${st.inDays} Tagen`
        : st.inDays >= -3 ? `Zyklustag ${st.cycleDay} · Periode ist ungefähr jetzt fällig` : `Zyklustag ${st.cycleDay}`;
    return fcard({ icon: 'drop', color: 'pink', title: 'Zyklus', sub, href: '#/eintragen' });
  },

  async analysis(ctx) {
    const starts = await loadStarts(ctx.client.id);
    const len = avgLength(starts);
    const plen = avgPeriod(starts);
    const st = cycleState(starts);
    const last = starts[starts.length - 1];
    const wrap = card('Zyklus',
      h('p', null, last ? `Letzte Periode: ${fmt(last.start_date)}${last.end_date ? ' – ' + fmt(last.end_date) : ' (läuft oder Ende fehlt)'}` : 'Noch kein Eintrag.'),
      h('table', { class: 'kv' }, h('tbody', null,
        st ? h('tr', null, h('th', null, 'Zyklustag heute'), h('td', null, String(st.cycleDay))) : null,
        len ? h('tr', null, h('th', null, 'Ø Zykluslänge'), h('td', null, `${fmtNum(len)} Tage`)) : null,
        plen ? h('tr', null, h('th', null, 'Ø Periodenlänge'), h('td', null, `${fmtNum(plen, 1)} Tage`)) : null,
        st ? h('tr', null, h('th', null, 'Nächste Periode (geschätzt)'), h('td', null, fmt(st.next))) : null)),
      starts.length > 1 ? h('div', { class: 'cycle-list' }, starts.slice(-6).reverse().map((s) => h('div', { class: 'list-row' },
        h('span', null, fmt(s.start_date), s.end_date ? ` – ${fmt(s.end_date)}` : ''),
        h('span', { class: 'muted small' }, s.end_date ? `${diffDays(s.start_date, s.end_date) + 1} Tage` : '')))) : null,
      h('p', { class: 'hint muted' }, 'Gespeichert werden nur Beginn und Ende der Periode. Die Vorhersage ist ein Durchschnittswert, keine Verhütung. Die Gewichtsgrafik zeigt diese Tage hinterlegt.'));

    if (ctx.role === 'client') {
      const d = input({ type: 'date', value: today(), max: today() });
      const e = input({ type: 'date', value: '', max: today() });
      const openOne = [...starts].reverse().find((s) => !s.end_date);
      wrap.append(
        h('div', { class: 'inline-form' }, field('Periodenbeginn nachtragen', d),
          h('button', {
            type: 'button', class: 'secondary', onclick: async () => {
              try { await q(from('cycle_entries').upsert({ client_id: ctx.client.id, start_date: d.value }, { onConflict: 'client_id,start_date', ignoreDuplicates: true })); toast('Eingetragen'); ctx.refresh(); }
              catch (err) { showError(err); }
            }
          }, 'Eintragen')),
        openOne ? h('div', { class: 'inline-form' }, field(`Ende der Periode vom ${fmt(openOne.start_date)}`, e),
          h('button', {
            type: 'button', class: 'secondary', onclick: async () => {
              if (!e.value || e.value < openOne.start_date) { toast('Bitte ein Datum nach dem Beginn wählen.', 'bad'); return; }
              try { await q(from('cycle_entries').update({ end_date: e.value }).eq('client_id', ctx.client.id).eq('start_date', openOne.start_date)); toast('Eingetragen'); ctx.refresh(); }
              catch (err) { showError(err); }
            }
          }, 'Eintragen')) : null,
        h('button', {
          type: 'button', class: 'link-btn danger', onclick: async () => {
            if (!await confirmDialog('Zyklus-Modul ausschalten und alle Einträge löschen?', { ok: 'Ausschalten & löschen', danger: true })) return;
            try {
              await q(from('cycle_entries').delete().eq('client_id', ctx.client.id));
              await q(from('client_settings').upsert({ client_id: ctx.client.id, cycle_enabled: false }, { onConflict: 'client_id' }));
              toast('Modul ausgeschaltet, Einträge gelöscht');
              location.reload();
            } catch (e) { showError(e); }
          }
        }, 'Modul ausschalten und alle Einträge löschen'));
    } else if (!starts.length) {
      wrap.append(empty('Die Kundin hat noch nichts eingetragen.'));
    }
    return wrap;
  }
};
