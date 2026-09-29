// Heute-Screen: rings for today's targets + what needs attention. Everything loads in parallel.
import { h, card, toast, showError, confirmDialog, fcard, skeleton, fmtNum, clear, tile } from '../core/ui.js';
import { q, from, rpc } from '../core/db.js';
import { today, addDays, weekStart, weekday, fmtLong, WEEKDAYS, range } from '../core/dates.js';
import { isPaused, PAUSE_REASONS } from '../core/goals.js';
import { reloadOwnClient } from '../core/app.js';
import { ringsCard } from '../core/rings.js';

const SKIP = ['client_id', 'day', 'updated_at', 'updated_by', 'not_tracked'];
const hasData = (r) => Object.entries(r).some(([k, v]) => !SKIP.includes(k) && v != null);

/** Rings for today: only for active modules with a target, plus weekly consistency */
function todayRings(app, client, ctx) {
  const t = client.targets || {};
  const act = (id) => app.modules.some((m) => m.id === id && app.isActive(m, client));
  const e = ctx.daily.find((r) => r.day === today()) || {};
  const items = [];
  if (act('nutrition') && t.kcal) items.push({ value: (e.kcal || 0) / t.kcal, color: 'pink', label: 'Kalorien', text: `${fmtNum(e.kcal || 0)} / ${fmtNum(t.kcal)}` });
  if (act('nutrition') && t.protein_g) items.push({ value: (e.protein_g || 0) / t.protein_g, color: 'ok', label: 'Protein', text: `${fmtNum(e.protein_g || 0)} / ${fmtNum(t.protein_g)} g` });
  if (act('activity') && t.steps) items.push({ value: (e.steps || 0) / t.steps, color: 'teal', label: 'Schritte', text: `${fmtNum(e.steps || 0)} / ${fmtNum(t.steps)}` });
  if (act('sleep') && t.sleep_h && items.length < 3) items.push({ value: (e.sleep_h || 0) / t.sleep_h, color: 'indigo', label: 'Schlaf', text: `${fmtNum(e.sleep_h || 0, 1)} / ${fmtNum(t.sleep_h, 1)} h` });
  const days = range(weekStart(today()), today());
  const logged = days.filter((d) => ctx.daily.some((r) => r.day === d && hasData(r))).length;
  items.push({ value: logged / days.length, color: 'accent', label: 'Diese Woche', text: `${logged}/${days.length} Tage` });
  return items.slice(0, 4);
}

function headCard(iconName, color, title, sub, ...rest) {
  return card(null,
    h('div', { class: 'row-main' }, tile(iconName, color, 40),
      h('div', null, h('div', { class: 'fc-title' }, title), sub ? h('div', { class: 'muted' }, sub) : null)),
    rest);
}

export async function renderToday(el, app) {
  const client = app.client;
  const paused = isPaused(client.status);
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  el.append(h('header', { class: 'page-head' }, h('div', null,
    h('p', { class: 'eyebrow' }, fmtLong(today())),
    h('h1', null, `${greet}, ${client.first_name}`))));
  const body = h('div', null, skeleton(3));
  el.append(body);

  // everything at once
  const wk = weekStart(today());
  const [ctx, fb, ci, notes] = await Promise.all([
    app.buildCtx(client, addDays(today(), -6)),
    q(from('checkins').select('id, feedback, feedback_seen_at').eq('client_id', client.id).not('feedback', 'is', null).order('feedback_at', { ascending: false }).limit(1)),
    q(from('checkins').select('id').eq('client_id', client.id).eq('week_start', wk)),
    q(from('notifications').select('*').eq('user_id', app.profile.id).is('read_at', null).in('kind', ['message', 'appointment']).order('created_at', { ascending: false }).limit(5))
  ]);
  const mods = app.modules.filter((x) => x.today && app.isActive(x, client));
  const moduleCards = await Promise.all(mods.map((m) => Promise.resolve().then(() => m.today(ctx)).catch((e) => { console.warn('today', m.id, e); return null; })));

  const out = [];

  if (paused) {
    const reason = PAUSE_REASONS.find(([k]) => k === client.status_reason)?.[1];
    out.push(headCard('pause', 'gray', 'Du bist gerade pausiert', reason ? `${reason} · Gute Besserung!` : 'Gute Besserung!',
      client.return_requested_at
        ? h('p', { class: 'ok-text' }, 'Max weiß Bescheid, dass du wieder fit bist.')
        : h('button', {
          type: 'button', onclick: async () => {
            try { await rpc('client_request_return'); await reloadOwnClient(); toast('Max wurde informiert'); location.reload(); } catch (e) { showError(e); }
          }
        }, 'Ich bin wieder fit')));
  } else {
    out.push(ringsCard(todayRings(app, client, ctx), 'Heute'));
  }

  // feedback from Max
  if (fb[0] && !fb[0].feedback_seen_at) {
    const c = headCard('message', 'accent', 'Feedback von Max', null,
      h('p', { class: 'prewrap', style: { marginTop: '12px' } }, fb[0].feedback),
      h('button', {
        type: 'button', class: 'secondary', onclick: async () => {
          try { await q(from('checkins').update({ feedback_seen_at: new Date().toISOString() }).eq('id', fb[0].id)); c.remove(); } catch (err) { showError(err); }
        }
      }, 'Gelesen'));
    c.classList.add('accent-border');
    out.push(c);
  }

  // messages from Max / appointment changes
  for (const n of notes) {
    const c = fcard({
      icon: n.kind === 'appointment' ? 'calendar' : 'message', color: n.kind === 'appointment' ? 'indigo' : 'accent', title: n.title, sub: n.body || '',
      action: { label: 'Ok', onClick: async () => { await q(from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)).catch(() => {}); c.remove(); } }
    });
    out.push(c);
  }

  if (!paused) {
    const yesterday = addDays(today(), -1);
    const has = (d) => ctx.daily.some((r) => r.day === d && hasData(r));
    if (!has(yesterday) && client.goal_start && client.goal_start <= yesterday) {
      out.push(fcard({ icon: 'clock', color: 'warn', title: 'Gestern fehlt noch', sub: 'Geht bis zu 3 Tage rückwirkend', href: `#/eintragen?tag=${yesterday}`, cls: 'warn' }));
    }
    out.push(has(today())
      ? fcard({ icon: 'check', color: 'ok', title: 'Heute eingetragen', sub: 'Tippen zum Ergänzen', href: '#/eintragen' })
      : fcard({ icon: 'pencil', color: 'accent', title: 'Abend-Check', sub: hour >= 17 ? 'Jetzt eintragen – unter 2 Minuten' : 'Heute Abend eintragen', href: '#/eintragen', cls: hour >= 17 ? 'hl' : '' }));

    const dueOffset = (client.checkin_weekday + 6) % 7;
    if (!ci.length && (weekday(today()) + 6) % 7 >= dueOffset) {
      out.push(fcard({ icon: 'checklist', color: 'purple', title: 'Wöchentlicher Check-in', sub: `Fällig am ${WEEKDAYS[client.checkin_weekday]} · ca. 1 Minute`, href: '#/checkin', cls: 'hl' }));
    }
  }

  out.push(...moduleCards.filter(Boolean));
  if (!paused) out.push(h('a', { class: 'link-btn center-block', href: '#/pause' }, 'Ich kann gerade nicht trainieren'));
  clear(body).append(out);
}

export async function renderPause(el, app) {
  const { PAUSE_DETAILS } = await import('../core/goals.js');
  const { select, input, field, textarea, segmented, backLink } = await import('../core/ui.js');
  let reason = null;
  const detailWrap = h('div');
  const until = input({ type: 'date', min: today() });
  const note = textarea({ maxlength: 1000, placeholder: 'Kurze Notiz (optional)' });
  let detailSel = null;
  const mentalHint = h('div', { class: 'hint', hidden: true },
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
    backLink('#/heute', 'Heute'),
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
