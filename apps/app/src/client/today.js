// Heute-Screen: what needs attention today.
import { h, card, toast, showError, confirmDialog } from '../core/ui.js';
import { q, from, rpc } from '../core/db.js';
import { today, addDays, weekStart, weekday, fmtLong, WEEKDAYS } from '../core/dates.js';
import { isPaused, PAUSE_REASONS } from '../core/goals.js';
import { reloadOwnClient } from '../core/app.js';

export async function renderToday(el, app) {
  const client = app.client;
  const ctx = await app.buildCtx(client, addDays(today(), -6));
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  el.append(h('header', { class: 'page-head' }, h('div', null, h('h1', null, `${greet}, ${client.first_name}`), h('p', { class: 'muted' }, fmtLong(today())))));

  // paused?
  if (isPaused(client.status)) {
    const reason = PAUSE_REASONS.find(([k]) => k === client.status_reason)?.[1];
    el.append(h('div', { class: 'card warn-border' },
      h('strong', null, '⏸ Du bist gerade pausiert', reason ? ` (${reason})` : ''),
      h('p', { class: 'muted' }, 'Erinnerungen sind stumm. Gute Besserung! Melde dich, wenn es wieder geht.'),
      client.return_requested_at
        ? h('p', { class: 'ok-text' }, '✓ Max weiß Bescheid, dass du wieder fit bist.')
        : h('button', {
          type: 'button', onclick: async () => {
            try { await rpc('client_request_return'); await reloadOwnClient(); toast('Max wurde informiert 💪'); location.reload(); } catch (e) { showError(e); }
          }
        }, 'Ich bin wieder fit')));
  }

  // feedback from Max
  const fb = await q(from('checkins').select('*').eq('client_id', client.id).not('feedback', 'is', null).order('feedback_at', { ascending: false }).limit(1));
  if (fb[0] && !fb[0].feedback_seen_at) {
    el.append(h('div', { class: 'card accent-border' },
      h('strong', null, '💬 Feedback von Max'),
      h('p', { class: 'prewrap' }, fb[0].feedback),
      h('button', {
        type: 'button', class: 'secondary', onclick: async (e) => {
          try { await q(from('checkins').update({ feedback_seen_at: new Date().toISOString() }).eq('id', fb[0].id)); e.target.closest('.card').remove(); } catch (err) { showError(err); }
        }
      }, 'Gelesen')));
  }

  // evening check status
  if (!isPaused(client.status)) {
    const has = (d) => ctx.daily.some((r) => r.day === d && Object.entries(r).some(([k, v]) => !['client_id', 'day', 'updated_at', 'updated_by', 'not_tracked'].includes(k) && v != null));
    const yesterday = addDays(today(), -1);
    if (!has(yesterday) && client.goal_start && client.goal_start <= yesterday) {
      el.append(h('a', { class: 'card card-link warn-border', href: `#/eintragen?tag=${yesterday}` },
        h('strong', null, '⏰ Gestern fehlt noch'), h('span', { class: 'muted' }, 'Bitte zeitnah eintragen – geht bis zu 3 Tage rückwirkend.')));
    }
    if (!has(today())) {
      el.append(h('a', { class: 'card card-link' + (hour >= 17 ? ' accent-border' : ''), href: '#/eintragen' },
        h('strong', null, '✍️ Abend-Check'), h('span', { class: 'muted' }, hour >= 17 ? 'Jetzt eintragen – dauert unter 2 Minuten.' : 'Heute Abend eintragen.')));
    } else {
      el.append(h('a', { class: 'card card-link', href: '#/eintragen' }, h('strong', null, '✅ Heute eingetragen'), h('span', { class: 'muted' }, 'Tippen zum Ergänzen')));
    }
  }

  // weekly check-in due?
  const wk = weekStart(today());
  const ci = await q(from('checkins').select('id').eq('client_id', client.id).eq('week_start', wk));
  const dueDay = client.checkin_weekday;
  const daysSinceMonday = (weekday(today()) + 6) % 7;
  const dueOffset = (dueDay + 6) % 7;
  if (!ci.length && daysSinceMonday >= dueOffset && !isPaused(client.status)) {
    el.append(h('a', { class: 'card card-link accent-border', href: '#/checkin' },
      h('strong', null, '📋 Wöchentlicher Check-in'), h('span', { class: 'muted' }, `Fällig am ${WEEKDAYS[dueDay]} – ca. 1 Minute`)));
  }

  // module cards
  for (const m of app.modules.filter((x) => x.today && app.isActive(x, client))) {
    try {
      const node = await m.today(ctx);
      if (node) el.append(node);
    } catch (e) { console.warn('today', m.id, e); }
  }

  // unread notifications (except popups handled elsewhere)
  const notes = await q(from('notifications').select('*').eq('user_id', app.profile.id).is('read_at', null).in('kind', ['message', 'appointment']).order('created_at', { ascending: false }).limit(5));
  for (const n of notes) {
    el.append(h('div', { class: 'card' }, h('strong', null, '📣 ', n.title), n.body ? h('p', null, n.body) : null,
      h('button', {
        type: 'button', class: 'link-btn', onclick: async (e) => {
          await q(from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)).catch(() => {});
          e.target.closest('.card').remove();
        }
      }, 'Ok')));
  }

  if (!isPaused(client.status)) {
    el.append(h('a', { class: 'link-btn center-block', href: '#/pause' }, 'Ich kann gerade nicht trainieren'));
  }
}

export async function renderPause(el, app) {
  const { PAUSE_DETAILS } = await import('../core/goals.js');
  const { select, input, field, textarea, segmented, backLink } = await import('../core/ui.js');
  let reason = null;
  const detailWrap = h('div');
  const until = input({ type: 'date', min: today() });
  const note = textarea({ maxlength: 1000, placeholder: 'Kurze Notiz (optional)' });
  let detailSel = null;
  const mentalHint = h('div', { class: 'card', hidden: true },
    h('p', null, 'Danke, dass du Bescheid sagst. Max meldet sich bei dir.'),
    h('p', null, 'Wenn es dir gerade sehr schlecht geht, rede mit jemandem: ', h('strong', null, 'SOS Détresse 454545'), ' (Luxemburg, anonym). Im Notfall: 112.'));
  const renderDetail = () => {
    detailWrap.replaceChildren();
    detailSel = null;
    mentalHint.hidden = reason !== 'mental';
    if (PAUSE_DETAILS[reason]) {
      detailSel = select([['', '– bitte wählen –'], ...PAUSE_DETAILS[reason].map((d) => [d, d])], '');
      const loc = input({ maxlength: 100, placeholder: 'Körperstelle, z. B. rechtes Knie' });
      detailWrap.append(field('Genauer', detailSel), reason !== 'illness' ? field('Wo?', loc) : null);
      detailSel.loc = loc;
    }
  };
  el.append(
    backLink('#/heute'),
    h('header', { class: 'page-head' }, h('div', null, h('h1', null, 'Pause melden'), h('p', { class: 'muted' }, 'Erinnerungen werden stumm geschaltet, Max wird informiert.'))),
    h('div', { class: 'card' },
      field('Grund', segmented(PAUSE_REASONS, null, (v) => { reason = v; renderDetail(); })),
      detailWrap, mentalHint,
      field('Voraussichtlich bis (optional)', until),
      field('Notiz', note),
      h('button', {
        type: 'button', onclick: async () => {
          if (!reason) { toast('Bitte einen Grund wählen.', 'bad'); return; }
          if (!await confirmDialog('Pause melden?')) return;
          const detail = detailSel ? [detailSel.value, detailSel.loc?.value].filter(Boolean).join(' · ') : null;
          try {
            await rpc('client_report_pause', { p_reason: reason, p_detail: detail || null, p_until: until.value || null, p_note: note.value.trim() || null });
            await reloadOwnClient();
            toast('Pause gemeldet. Gute Besserung!');
            location.hash = '#/heute';
          } catch (e) { showError(e); }
        }
      }, 'Pause melden')));
}

export { card };
