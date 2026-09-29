// M2 Cardio incl. KM Pacer (offline pace coach at /modules/cardio/pacer/).
import { h, card, fmtNum, empty, select, input, field, modal, toast, showError, confirmDialog, parseNum, rating, textarea, uuid, fcard } from '../../core/ui.js';
import { chart, meter } from '../../core/chart.js';
import { kpi, kpiRow } from '../../core/metric.js';
import { perWeek } from '../../core/metrics.js';
import { q, from } from '../../core/db.js';
import { today, addDays, weekStart, relDay, fmt, WD_SHORT, weekday, range } from '../../core/dates.js';

const KINDS = [['run', 'Laufen'], ['bike', 'Rad'], ['swim', 'Schwimmen'], ['row', 'Rudern'], ['walk', 'Gehen/Wandern'], ['other', 'Sonstiges']];
const INTENSITIES = [['easy', 'locker'], ['tempo', 'Tempo'], ['interval', 'Intervall'], ['long', 'lang']];
const label = (list, v) => list.find(([k]) => k === v)?.[1] || v || '';
const PACER_OUTBOX = 'mx_pacer_outbox';

function paceText(min, km) {
  if (!min || !km) return null;
  const secPerKm = (min * 60) / km;
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')} /km`;
}

async function loadSessions(clientId, fromDay, toDay = today()) {
  return q(from('cardio_sessions').select('*').eq('client_id', clientId).gte('day', fromDay).lte('day', toDay).order('day', { ascending: false }));
}

function pacerOutbox() { try { return JSON.parse(localStorage.getItem(PACER_OUTBOX) || '[]'); } catch (e) { return []; } }
function setPacerOutbox(list) { localStorage.setItem(PACER_OUTBOX, JSON.stringify(list)); }

function localDay(ts) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

async function importPacerRun(ctx, run) {
  const totalSec = run.splits.reduce((s, sp) => s + sp.durationSec, 0);
  const km = run.splits.reduce((s, sp) => s + sp.distanceKm, 0);
  const day = localDay(run.finishTime || run.startTime);
  await q(from('cardio_sessions').insert({
    id: uuid(), client_id: ctx.client.id, day, kind: 'run', source: 'pacer',
    duration_min: Math.round(totalSec / 6) / 10, distance_km: Math.round(km * 100) / 100,
    splits: run.splits.map((sp) => ({ km: sp.kmLabel, distance_km: sp.distanceKm, sec: sp.durationSec }))
  }));
}

async function editSession(ctx, s) {
  const kind = select(KINDS, s?.kind || 'run');
  const day = input({ type: 'date', value: s?.day || today(), max: today(), min: ctx.role === 'coach' ? undefined : addDays(today(), -3) });
  const dur = input({ type: 'number', step: '1', inputmode: 'numeric', value: s?.duration_min ?? '', placeholder: 'Minuten' });
  const dist = input({ type: 'number', step: '0.01', inputmode: 'decimal', value: s?.distance_km ?? '', placeholder: 'km (optional)' });
  const intensity = select([['', '–'], ...INTENSITIES], s?.intensity || '');
  const effort = rating(s?.effort ?? null, { max: 10 });
  const hr = input({ type: 'number', step: '1', inputmode: 'numeric', value: s?.avg_hr ?? '', placeholder: 'optional' });
  const note = textarea({ value: s?.note || '', maxlength: 1000 });
  await modal(s ? 'Einheit bearbeiten' : 'Cardio eintragen', h('div', null,
    h('div', { class: 'grid2' }, field('Art', kind), field('Datum', day)),
    h('div', { class: 'grid2' }, field('Dauer (min)', dur), field('Distanz (km)', dist)),
    field('Intensität', intensity),
    field('Anstrengung (1–10)', effort),
    field('Ø Puls', hr),
    field('Notiz', note)), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Speichern', onClick: async () => {
        const row = {
          client_id: ctx.client.id, day: day.value, kind: kind.value,
          duration_min: parseNum(dur.value), distance_km: parseNum(dist.value),
          intensity: intensity.value || null, effort: effort.value, avg_hr: parseNum(hr.value), note: note.value.trim() || null
        };
        if (!row.duration_min && !row.distance_km) { toast('Bitte Dauer oder Distanz eingeben.', 'bad'); return undefined; }
        try {
          if (s) await q(from('cardio_sessions').update(row).eq('id', s.id));
          else await q(from('cardio_sessions').insert({ ...row, id: uuid(), source: 'manual' }));
          toast('Gespeichert'); ctx.refresh(); return true;
        } catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

function sessionRow(ctx, s) {
  const editable = ctx.role === 'coach' || s.day >= addDays(today(), -3);
  return h('div', { class: 'list-row' },
    h('div', null,
      h('strong', null, label(KINDS, s.kind), s.source === 'pacer' ? ' ' : ''),
      h('div', { class: 'muted small' }, [relDay(s.day), s.duration_min ? `${fmtNum(s.duration_min)} min` : null, s.distance_km ? `${fmtNum(s.distance_km, 2)} km` : null,
        s.kind === 'run' ? paceText(s.duration_min, s.distance_km) : null, label(INTENSITIES, s.intensity), s.effort ? `Anstr. ${s.effort}/10` : null].filter(Boolean).join(' · '))),
    editable ? h('div', { class: 'row-actions' },
      h('button', { type: 'button', class: 'link-btn', onclick: () => editSession(ctx, s) }, 'Bearbeiten'),
      h('button', {
        type: 'button', class: 'link-btn danger', onclick: async () => {
          if (!await confirmDialog('Einheit löschen?', { ok: 'Löschen', danger: true })) return;
          try { await q(from('cardio_sessions').delete().eq('id', s.id)); ctx.refresh(); } catch (e) { showError(e); }
        }
      }, 'Löschen')) : null);
}

export default {
  id: 'cardio',
  name: 'Cardio',
  order: 2,
  icon: 'run',
  color: 'ok',
  description: 'Laufen, Rad & Co. mit Wochenvorgabe, Pace-Verlauf und KM Pacer',
  config: [
    { key: 'cardio_min_week', label: 'Cardio-Ziel pro Woche', short: 'Ziel', type: 'number', store: 'target', unit: 'min', step: 5 }
  ],

  async today(ctx) {
    const plan = ctx.client.targets?.cardio_week || [];
    const wd = weekday(today());
    const todays = plan.filter((p) => Number(p.wd) === wd);
    if (!todays.length) return null;
    const done = await loadSessions(ctx.client.id, today());
    if (done.length) return null;
    return fcard({
      icon: 'run', color: 'ok', title: 'Heute Cardio',
      sub: todays.map((p) => `${label(KINDS, p.kind)} ${p.duration_min ? p.duration_min + ' min' : ''} ${label(INTENSITIES, p.intensity)}`.trim()).join(', ') + (todays[0].note ? ' · ' + todays[0].note : ''),
      href: '#/training'
    });
  },

  async training(ctx) {
    const wrap = h('div');
    // KM Pacer results waiting to be imported
    const pending = ctx.role === 'client' ? pacerOutbox() : [];
    if (pending.length) {
      wrap.append(h('div', { class: 'card accent-border' },
        h('strong', null, `${pending.length} Lauf/Läufe aus dem KM Pacer`),
        pending.map((run, i) => {
          const km = run.splits.reduce((s, sp) => s + sp.distanceKm, 0);
          const sec = run.splits.reduce((s, sp) => s + sp.durationSec, 0);
          return h('div', { class: 'list-row' },
            h('span', null, `${fmt(localDay(run.finishTime || run.startTime))} · ${fmtNum(km, 1)} km · ${Math.floor(sec / 60)} min`),
            h('div', { class: 'row-actions' },
              h('button', {
                type: 'button', class: 'link-btn', onclick: async () => {
                  try { await importPacerRun(ctx, run); const list = pacerOutbox(); list.splice(i, 1); setPacerOutbox(list); toast('Übernommen'); ctx.refresh(); }
                  catch (e) { showError(e); }
                }
              }, 'Übernehmen'),
              h('button', { type: 'button', class: 'link-btn danger', onclick: () => { const list = pacerOutbox(); list.splice(i, 1); setPacerOutbox(list); ctx.refresh(); } }, 'Verwerfen')));
        }),
        h('p', { class: 'muted small' }, 'Läufe, die älter als 3 Tage sind, kann nur Max nachtragen.')));
    }

    const plan = ctx.client.targets?.cardio_week || [];
    const week = await loadSessions(ctx.client.id, weekStart(today()));
    wrap.append(card('Cardio diese Woche',
      plan.length ? plan.map((p) => h('div', { class: 'list-row' },
        h('span', null, h('strong', null, WD_SHORT[p.wd] + ' '), `${label(KINDS, p.kind)} ${p.duration_min ? p.duration_min + ' min' : ''} ${label(INTENSITIES, p.intensity)}`),
        p.note ? h('small', { class: 'muted' }, p.note) : null)) : h('p', { class: 'muted' }, 'Keine feste Vorgabe von Max.'),
      h('p', { class: 'muted small' }, `Erledigt: ${week.length} Einheit(en), ${fmtNum(week.reduce((a, s) => a + Number(s.duration_min || 0), 0))} min`),
      h('div', { class: 'row-actions wrap' },
        h('button', { type: 'button', onclick: () => editSession(ctx, null) }, '+ Cardio eintragen'),
        ctx.role === 'client' ? h('a', { class: 'button secondary', href: '/modules/cardio/pacer/index.html' }, 'KM Pacer öffnen') : null),
      ctx.role === 'client' ? h('p', { class: 'muted small' }, 'Der KM Pacer läuft offline. Bildschirm während des Laufs anlassen, es wird keine GPS-Spur gespeichert.') : null));

    const recent = await loadSessions(ctx.client.id, addDays(today(), -30));
    wrap.append(card('Letzte Einheiten', recent.length ? recent.slice(0, 15).map((s) => sessionRow(ctx, s)) : empty('Noch keine Einheiten.')));
    return wrap;
  },

  async analysis(ctx) {
    const sessions = await loadSessions(ctx.client.id, ctx.from, ctx.to);
    const weeks = [...new Set(range(ctx.from, ctx.to).map(weekStart))];
    const min = perWeek(sessions, 'duration_min', 'sum');
    const km = perWeek(sessions, 'distance_km', 'sum');
    const runs = sessions.filter((s) => s.kind === 'run' && s.duration_min && s.distance_km)
      .map((s) => ({ d: s.day, v: (s.duration_min * 60) / s.distance_km / 60 }));
    const withInt = sessions.filter((s) => s.intensity);
    const easy = withInt.filter((s) => s.intensity === 'easy' || s.intensity === 'long').length;
    const target = ctx.client.targets?.cardio_min_week;
    const thisWeek = min.find((m) => m.d === weekStart(today()))?.v || 0;

    return card('Cardio',
      kpiRow(
        kpi('Diese Woche', fmtNum(thisWeek), { unit: 'min', sub: target ? `Ziel ${target} min` : '' }),
        kpi('Einheiten', String(sessions.length), { sub: 'im Zeitraum' }),
        kpi('Locker vs. intensiv', withInt.length ? `${fmtNum((easy / withInt.length) * 100)} %` : '–', { sub: 'locker' })),
      chart({ from: weeks[0], to: weeks[weeks.length - 1] || ctx.to, unit: 'min', zero: true, series: [{ label: 'Minuten/Woche', points: min, type: 'bar', digits: 0 }], band: target ? { min: target, max: target * 1.2 } : null }),
      km.length ? chart({ from: weeks[0], to: weeks[weeks.length - 1] || ctx.to, unit: 'km', zero: true, series: [{ label: 'km/Woche', points: km, type: 'bar', cls: 'muted', digits: 1 }] }) : null,
      runs.length > 1 ? h('div', null, h('p', { class: 'muted small' }, 'Pace Laufen (min/km, niedriger = schneller)'),
        chart({ from: ctx.from, to: ctx.to, unit: 'min/km', series: [{ label: 'Pace', points: runs, cls: 'accent', digits: 2, maxGap: 999 }] })) : null,
      withInt.length ? h('div', { class: 'macro' }, h('div', { class: 'macro-head' }, h('span', null, 'Anteil locker'), h('span', { class: 'muted' }, `${easy}/${withInt.length}`)), meter(easy / withInt.length, 'ok')) : null);
  },

  async coach(ctx) {
    const plan = structuredClone(ctx.client.targets?.cardio_week || []);
    const list = h('div');
    const render = () => {
      list.replaceChildren(...plan.map((p, i) => {
        const wd = select(WD_SHORT.map((d, j) => [j, d]), p.wd ?? 1, { class: 'mini' });
        const kind = select(KINDS, p.kind || 'run', { class: 'mini' });
        const dur = input({ type: 'number', value: p.duration_min ?? '', placeholder: 'min', class: 'mini' });
        const inten = select([['', '–'], ...INTENSITIES], p.intensity || '', { class: 'mini' });
        const note = input({ value: p.note || '', placeholder: 'Hinweis', maxlength: 120 });
        const sync = () => Object.assign(p, { wd: Number(wd.value), kind: kind.value, duration_min: parseNum(dur.value), intensity: inten.value || null, note: note.value.trim() || null });
        [wd, kind, dur, inten, note].forEach((x) => x.addEventListener('change', sync));
        return h('div', { class: 'plan-grid cardio-plan' }, wd, kind, dur, inten, note,
          h('button', { type: 'button', class: 'link-btn danger', onclick: () => { plan.splice(i, 1); render(); } }, '✕'));
      }));
    };
    render();
    const sessions = await loadSessions(ctx.client.id, addDays(today(), -30));
    const frag = document.createDocumentFragment();
    frag.append(
      card('Cardio-Vorgabe pro Woche', list,
        h('div', { class: 'row-actions wrap' },
          h('button', { type: 'button', class: 'secondary', onclick: () => { plan.push({ wd: 1, kind: 'run', duration_min: 30, intensity: 'easy' }); render(); } }, '+ Einheit'),
          h('button', {
            type: 'button', onclick: async () => {
              try {
                await q(from('clients').update({ targets: { ...(ctx.client.targets || {}), cardio_week: plan } }).eq('id', ctx.client.id));
                toast('Cardio-Vorgabe gespeichert'); ctx.refresh();
              } catch (e) { showError(e); }
            }
          }, 'Speichern'))),
      card('Letzte Einheiten', sessions.length ? sessions.map((s) => sessionRow(ctx, s)) : empty('Noch keine Einheiten.'),
        h('button', { type: 'button', class: 'secondary', onclick: () => editSession(ctx, null) }, '+ Einheit nachtragen')));
    return frag;
  },

  async summary(ctx, fromDay, toDay) {
    const s = await loadSessions(ctx.client.id, fromDay, toDay);
    return [{ label: 'Cardio', value: `${s.length} Einheit${s.length === 1 ? '' : 'en'}, ${fmtNum(s.reduce((a, x) => a + Number(x.duration_min || 0), 0))} min, ${fmtNum(s.reduce((a, x) => a + Number(x.distance_km || 0), 0), 1)} km` }];
  }
};
