// Weekly check-in: few tap questions + automatic summary of the week.
import { h, rating, textarea, field, toast, showError, card, backLink } from '../core/ui.js';
import { q, from } from '../core/db.js';
import { today, addDays, weekStart, fmt } from '../core/dates.js';

/** Weekly summary from all active modules (used at submit and in the coach view) */
export async function weekSummary(app, client, fromDay, toDay) {
  const ctx = await app.buildCtx(client, fromDay, toDay);
  const out = [];
  for (const m of app.modules.filter((x) => x.summary && app.isActive(x, client))) {
    try { out.push(...(await m.summary(ctx, fromDay, toDay))); } catch (e) { /* skip */ }
  }
  return out;
}

export async function renderCheckin(el, app) {
  const client = app.client;
  const wk = weekStart(today());
  const existing = (await q(from('checkins').select('*').eq('client_id', client.id).eq('week_start', wk)))[0];
  const closed = !!existing?.feedback;

  const rate = rating(existing?.rating ?? null, { labels: ['sehr schlecht', 'schlecht', 'okay', 'gut', 'sehr gut'] });
  const rateText = textarea({ value: existing?.rating_text || '', maxlength: 2000, placeholder: 'Magst du etwas dazu sagen? (optional)' });
  const hunger = rating(existing?.hunger ?? null, { labels: ['kaum', 'wenig', 'normal', 'viel', 'sehr viel'] });
  const stress = rating(existing?.stress ?? null, { labels: ['kaum', 'wenig', 'mittel', 'hoch', 'sehr hoch'] });
  const recovery = rating(existing?.recovery ?? null, { labels: ['sehr schlecht', 'schlecht', 'okay', 'gut', 'sehr gut'] });
  const difficult = textarea({ value: existing?.difficult || '', maxlength: 2000, placeholder: 'Was war schwierig? (optional)' });

  el.append(backLink('#/heute'),
    h('header', { class: 'page-head' }, h('div', null, h('h1', null, 'Wöchentlicher Check-in'), h('p', { class: 'muted' }, `Woche ab ${fmt(wk)}`))));

  if (closed) {
    el.append(card('Feedback von Max', h('p', { class: 'prewrap' }, existing.feedback)),
      h('p', { class: 'muted' }, 'Dieser Check-in ist abgeschlossen.'));
    return;
  }

  el.append(h('div', { class: 'card' },
    field('Wie lief die Woche?', rate), rateText,
    field('Hunger', hunger), field('Stress', stress), field('Regeneration', recovery),
    field('Was war schwierig?', difficult),
    h('p', { class: 'muted small' }, 'Eine Zusammenfassung deiner Einträge der letzten 7 Tage wird automatisch angehängt.'),
    h('button', {
      type: 'button', onclick: async (e) => {
        if (!rate.value) { toast('Bitte zumindest „Wie lief die Woche?“ antippen.', 'bad'); return; }
        e.target.disabled = true;
        try {
          const summary = await weekSummary(app, client, addDays(today(), -6), today());
          const row = {
            client_id: client.id, week_start: wk, rating: rate.value, rating_text: rateText.value.trim() || null,
            hunger: hunger.value, stress: stress.value, recovery: recovery.value, difficult: difficult.value.trim() || null,
            summary: { items: summary, from: addDays(today(), -6), to: today() }
          };
          if (existing) await q(from('checkins').update(row).eq('id', existing.id));
          else await q(from('checkins').insert(row));
          toast('Check-in abgegeben – Max meldet sich mit Feedback.');
          location.hash = '#/heute';
        } catch (err) { showError(err); e.target.disabled = false; }
      }
    }, existing ? 'Aktualisieren' : 'Abgeben')));
}
