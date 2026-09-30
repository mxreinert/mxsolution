// Abend-Check: one page, only active modules, < 2 minutes.
// Also used for single values (e.g. ?nur=weight_kg in the morning) and up to 3 days back.
import { h, clear, input, rating, segmented, textarea, toast, showError, fmtNum, parseNum, tile, skeleton } from '../core/ui.js';
import { activeFields } from '../core/modcfg.js';
import { q, from } from '../core/db.js';
import { today, addDays, fmtLong, relDay } from '../core/dates.js';
import { clientThresholds } from '../core/settings.js';

export async function renderLog(el, app, query) {
  const client = app.client;
  const days = [0, 1, 2, 3].map((n) => addDays(today(), -n));
  let day = days.includes(query.tag) ? query.tag : today();
  const only = query.nur || null;
  const body = h('div');

  el.append(h('header', { class: 'page-head' }, h('div', null, h('h1', null, only ? 'Eintragen' : 'Abend-Check'),
    h('p', { class: 'muted' }, 'Leere Felder sind okay – lieber unvollständig als gar nicht.'))),
  segmented(days.map((d) => [d, d === today() ? 'Heute' : relDay(d)]), day, (v) => { day = v; draw(); }),
  body);

  const draw = async () => {
    clear(body).append(skeleton(2));
    const ctx = await app.buildCtx(client, addDays(day, -7), day, { day });
    const row = ctx.daily.find((r) => r.day === day) || {};
    const prevRows = ctx.daily.filter((r) => r.day < day).sort((a, b) => (a.day < b.day ? 1 : -1));
    const prevVal = (k) => prevRows.find((r) => r[k] != null)?.[k] ?? null;
    const notTracked = new Set(row.not_tracked || []);
    const values = {};
    const thresholds = clientThresholds(app.settings, client);
    const mods = app.modules.filter((m) => app.isActive(m, client) && (m.daily || m.evening));

    clear(body).append(h('p', { class: 'day-label' }, fmtLong(day)));

    for (const m of mods) {
      const fields = (only ? (m.daily || []) : activeFields(m, client, app.settings)).filter((f) => !only || f.key === only);
      if (!fields.length && (only || !m.evening)) continue;
      const set = h('fieldset', { class: 'evening-section' }, h('legend', null, m.icon ? tile(m.icon, m.color, 28) : null, m.name));
      const groupKeys = m.trackGroup || null;
      const groupOff = groupKeys && groupKeys.every((k) => notTracked.has(k));

      for (const f of fields) {
        const wrap = h('div', { class: 'efield' });
        const label = h('label', null, f.label, f.unit ? h('small', { class: 'muted' }, ` (${f.unit})`) : null);
        const warn = h('small', { class: 'warn-text' });
        let control;
        if (f.type === 'rating') {
          control = rating(row[f.key] ?? null, { labels: f.labels, onChange: (v) => { values[f.key] = v; } });
        } else {
          const prev = prevVal(f.key);
          control = input({
            type: 'number', step: f.step, min: f.min, max: f.max, value: row[f.key] ?? '',
            placeholder: prev != null ? `zuletzt ${fmtNum(prev, f.type === 'dec' ? 1 : 0)}` : '',
            'aria-label': f.label
          });
          control.addEventListener('input', () => { values[f.key] = parseNum(control.value); });
          control.addEventListener('blur', () => {
            const v = parseNum(control.value);
            warn.textContent = v != null && f.plaus ? (f.plaus(v, prev, thresholds) || '') : '';
          });
        }
        label.htmlFor = control.id = 'e_' + f.key;
        wrap.append(label, control, f.hint ? h('small', { class: 'muted' }, f.hint) : null, warn);

        // "Nicht getrackt" per field (or once for the whole group)
        if (!groupKeys && f.type !== 'rating') {
          const nt = h('button', {
            type: 'button', class: 'nt-btn' + (notTracked.has(f.key) ? ' on' : ''), onclick: () => {
              notTracked.has(f.key) ? notTracked.delete(f.key) : notTracked.add(f.key);
              nt.classList.toggle('on', notTracked.has(f.key));
              control.disabled = notTracked.has(f.key);
            }
          }, 'nicht getrackt');
          control.disabled = notTracked.has(f.key);
          wrap.append(nt);
        } else if (groupOff) {
          control.disabled = true;
        }
        set.append(wrap);
      }

      if (groupKeys && fields.length) {
        const nt = h('button', {
          type: 'button', class: 'nt-btn' + (groupOff ? ' on' : ''), onclick: () => {
            const off = !groupKeys.every((k) => notTracked.has(k));
            groupKeys.forEach((k) => (off ? notTracked.add(k) : notTracked.delete(k)));
            nt.classList.toggle('on', off);
            set.querySelectorAll('input').forEach((i) => { i.disabled = off; });
          }
        }, `${m.name} heute bewusst nicht getrackt`);
        set.append(nt);
      }

      if (!only && m.evening) {
        try {
          const sec = await m.evening(ctx);
          if (sec) { set.append(...sec.el.childNodes.length && sec.el.tagName === 'FIELDSET' ? [...sec.el.childNodes].filter((n) => n.tagName !== 'LEGEND') : [sec.el]); set.saveHook = sec.save; }
        } catch (e) { console.warn('evening', m.id, e); }
      }
      if (set.childNodes.length > 1) body.append(set);
    }

    let note = null;
    if (!only) {
      note = textarea({ value: row.note || '', maxlength: 1000, placeholder: 'Wie war der Tag? (optional)' });
      body.append(h('fieldset', { class: 'evening-section' }, h('legend', null, tile('message', 'gray', 28), 'Notiz'), note));
    }
    if (body.querySelectorAll('fieldset').length === 0) {
      body.append(h('p', { class: 'muted' }, 'Für dich sind noch keine Werte zum Eintragen aktiv. Max richtet das ein.'));
      return;
    }

    body.append(h('button', {
      type: 'button', class: 'sticky-save', onclick: async (e) => {
        e.target.disabled = true;
        try {
          const payload = { client_id: client.id, day, not_tracked: [...notTracked] };
          for (const [k, v] of Object.entries(values)) payload[k] = v;
          // keep values not shown on this page (e.g. morning weight) – upsert merges only given columns
          if (note) payload.note = note.value.trim() || null;
          for (const k of notTracked) payload[k] = null;
          await q(from('daily_entries').upsert(payload, { onConflict: 'client_id,day' }));
          for (const set of body.querySelectorAll('fieldset')) if (set.saveHook) await set.saveHook(day);
          toast('Gespeichert ✓');
          location.hash = '#/heute';
        } catch (err) { showError(err); e.target.disabled = false; }
      }
    }, 'Speichern'));
  };
  await draw();
}
