// M14 Zyklus: only the start date of the period. Explicit consent required.
// The client can switch the module off and delete all entries herself.
import { h, card, fmtNum, confirmDialog, toast, showError, empty, input, field } from '../../core/ui.js';
import { q, from } from '../../core/db.js';
import { addDays, today, diffDays, fmt } from '../../core/dates.js';

async function loadStarts(clientId) {
  return q(from('cycle_entries').select('start_date').eq('client_id', clientId).order('start_date'));
}

function avgLength(starts) {
  const diffs = [];
  for (let i = 1; i < starts.length; i++) {
    const d = diffDays(starts[i - 1].start_date, starts[i].start_date);
    if (d >= 18 && d <= 45) diffs.push(d);
  }
  return diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;
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
      bands.push({ from: s.start_date, to: addDays(s.start_date, 4), cls: 'cycle' });
      bands.push({ from: addDays(s.start_date, len - 5), to: addDays(s.start_date, len - 1), cls: 'cycle-pre' });
    }
    return { bands, hints: starts.length ? [{ for: 'weight', text: 'Hinterlegte Tage: Periode und Tage davor – hier sind Wassereinlagerungen von 1–2 kg typisch.' }] : [] };
  },

  async evening(ctx) {
    const starts = await loadStarts(ctx.client.id);
    const already = starts.some((s) => s.start_date === ctx.day);
    let mark = false;
    const btn = h('button', {
      type: 'button', class: 'secondary' + (already ? ' on' : ''), disabled: already,
      onclick: () => { mark = !mark; btn.classList.toggle('on', mark); btn.textContent = mark ? '✓ Periode hat begonnen' : 'Periode hat an diesem Tag begonnen'; }
    }, already ? '✓ Periodenbeginn eingetragen' : 'Periode hat an diesem Tag begonnen');
    return {
      el: h('fieldset', { class: 'evening-section' }, h('legend', null, 'Zyklus'), btn),
      async save(day) {
        if (mark && !already) await q(from('cycle_entries').insert({ client_id: ctx.client.id, start_date: day }));
      }
    };
  },

  async analysis(ctx) {
    const starts = await loadStarts(ctx.client.id);
    const len = avgLength(starts);
    const last = starts[starts.length - 1];
    const wrap = card('Zyklus',
      h('p', null, last ? `Letzter Periodenbeginn: ${fmt(last.start_date)} (Tag ${diffDays(last.start_date, today()) + 1})` : 'Noch kein Eintrag.'),
      len ? h('p', { class: 'muted' }, `Durchschnittliche Zykluslänge: ${fmtNum(len)} Tage`) : null,
      h('p', { class: 'hint muted' }, 'Gespeichert wird nur das Datum des Periodenbeginns. Die Gewichtsgrafik zeigt diese Tage hinterlegt.'));

    if (ctx.role === 'client') {
      const d = input({ type: 'date', value: today(), max: today() });
      wrap.append(
        h('div', { class: 'inline-form' }, field('Periodenbeginn nachtragen', d),
          h('button', {
            type: 'button', class: 'secondary', onclick: async () => {
              try { await q(from('cycle_entries').upsert({ client_id: ctx.client.id, start_date: d.value }, { onConflict: 'client_id,start_date' })); toast('Eingetragen'); ctx.refresh(); }
              catch (e) { showError(e); }
            }
          }, 'Eintragen')),
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
