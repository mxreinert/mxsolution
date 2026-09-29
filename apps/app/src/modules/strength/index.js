// M1 Krafttraining: plans, logger, progression, analysis.
import { h, card, fmtNum, empty, select, showError, toast, clear, confirmDialog, modal, input, field, parseNum, badge, fcard, icon } from '../../core/ui.js';
import { chart, meter } from '../../core/chart.js';
import { kpi, kpiRow } from '../../core/metric.js';
import { e1rm } from '../../core/metrics.js';
import { q, from } from '../../core/db.js';
import { today, addDays, weekStart, fmtShort, relDay, fmt, range } from '../../core/dates.js';
import { exerciseMap, activePlan, recentWorkouts, setsForWorkouts, testedMaxes, openDrafts, pendingCount, syncOutbox } from './data.js';
import { newWorkout, renderLogger } from './logger.js';
import { renderPlanList, renderPlanEditor, assignTemplate, chooseTemplate } from './plans.js';

/** Which session is next: the one after the last logged plan session */
function nextSession(plan, workouts) {
  if (!plan?.sessions?.length) return null;
  const last = workouts.find((w) => w.plan_id === plan.id && w.session_key);
  if (!last) return plan.sessions[0];
  const i = plan.sessions.findIndex((s) => s.key === last.session_key);
  return plan.sessions[(i + 1) % plan.sessions.length];
}

function currentWeek(plan) {
  if (!plan?.start_date || !plan.weeks) return null;
  const w = Math.floor((new Date(today()) - new Date(plan.start_date)) / (7 * 864e5)) + 1;
  return w;
}

function startWorkout(ctx, plan, session, kind = 'plan', extra = {}) {
  const w = newWorkout({ client: ctx.client, plan, session, kind, ...extra });
  location.hash = ctx.role === 'coach' ? `#/c/kunde/${ctx.client.id}/training/${w.id}` : `#/training/kraft/${w.id}`;
}

function hevyActive(ctx) { return ctx.client.unlocks?.includes('hevy') && ctx.hevyConnected; }

/** muscle group volume: primary 1 set, secondary 0.5 set, warmups excluded */
function volumeByMuscle(sets, exMap) {
  const vol = new Map();
  for (const s of sets) {
    if (s.set_type === 'warmup') continue;
    const ex = exMap.get(s.exercise_id);
    if (!ex) continue;
    vol.set(ex.primary_muscle, (vol.get(ex.primary_muscle) || 0) + 1);
    for (const m of ex.secondary || []) vol.set(m, (vol.get(m) || 0) + 0.5);
  }
  return [...vol.entries()].sort((a, b) => b[1] - a[1]);
}

async function workoutDetails(w, exMap) {
  const sets = await setsForWorkouts([w.id]);
  const byEx = new Map();
  sets.sort((a, b) => a.pos - b.pos || a.set_no - b.set_no).forEach((s) => {
    if (!byEx.has(s.exercise_id)) byEx.set(s.exercise_id, []);
    byEx.get(s.exercise_id).push(s);
  });
  return h('div', null,
    h('p', { class: 'muted' }, [fmt(w.day), w.effort ? `Anstrengung ${w.effort}/10` : null, w.with_coach ? 'mit Max' : null, w.source === 'hevy' ? 'aus Hevy' : null].filter(Boolean).join(' · ')),
    w.pain ? h('p', { class: 'bad-text' }, 'Beschwerden: ', w.pain_location || 'ohne Angabe') : null,
    w.note ? h('p', null, w.note) : null,
    [...byEx.entries()].map(([id, ss]) => h('div', { class: 'macro' },
      h('strong', null, exMap.get(id)?.name || id),
      h('div', { class: 'muted small' }, ss.map((s) => (s.set_type === 'warmup' ? 'W ' : '') +
        (s.seconds ? `${s.seconds}s` : s.distance_m ? `${fmtNum(s.distance_m)} m` : `${s.weight_kg != null ? fmtNum(s.weight_kg, 1) + '×' : ''}${s.reps ?? ''}`) +
        (s.rir != null ? ` @${fmtNum(s.rir, 1)}` : '')).join(' · ')))));
}

export default {
  id: 'strength',
  name: 'Krafttraining',
  order: 1,
  icon: 'dumbbell',
  color: 'accent',
  description: 'Trainingspläne, Logger mit Progression, 1RM und Volumen pro Muskel',

  /** app start: push workouts that were logged offline */
  start() { syncOutbox().catch(() => {}); },

  async today(ctx) {
    if (hevyActive(ctx)) return null;
    const [plan, workouts] = await Promise.all([activePlan(ctx.client.id), recentWorkouts(ctx.client.id, addDays(today(), -30), 30)]);
    const drafts = openDrafts(ctx.client.id).filter((d) => !d.finished_at);
    if (drafts.length) {
      return fcard({ icon: 'dumbbell', color: 'accent', title: `Training läuft: ${drafts[0].session_name}`, sub: 'Weiter eintragen', href: `#/training/kraft/${drafts[0].id}`, cls: 'hl' });
    }
    if (workouts.some((w) => w.day === today())) {
      return fcard({ icon: 'check', color: 'ok', title: 'Heute schon trainiert', sub: 'Stark! Regeneration zählt auch.', href: '#/training' });
    }
    const next = nextSession(plan, workouts);
    if (!next) return null;
    return fcard({
      icon: 'dumbbell', color: 'accent', title: next.name,
      sub: `Nächstes Training · ${next.exercises.length} Übung${next.exercises.length === 1 ? '' : 'en'}`,
      action: { label: 'Starten', onClick: () => startWorkout(ctx, plan, next) }
    });
  },

  async training(ctx) {
    const wrap = h('div');
    if (hevyActive(ctx)) {
      wrap.append(card('Krafttraining', h('p', null, 'Deine Trainings kommen aus Hevy. Einfach wie gewohnt in Hevy eintragen – sie erscheinen hier und bei Max automatisch.')));
    }
    const pending = pendingCount();
    if (pending) {
      wrap.append(h('div', { class: 'card warn-border' },
        h('p', null, `${pending} Training(s) noch nicht synchronisiert.`),
        h('button', { type: 'button', class: 'secondary', onclick: async () => { const left = await syncOutbox(); toast(left ? 'Noch offline – später nochmal.' : 'Synchronisiert'); ctx.refresh(); } }, 'Jetzt synchronisieren')));
    }
    const drafts = openDrafts(ctx.client.id).filter((d) => !d.finished_at);
    for (const d of drafts) {
      wrap.append(h('a', { class: 'card card-link accent-border', href: ctx.role === 'coach' ? `#/c/kunde/${ctx.client.id}/training/${d.id}` : `#/training/kraft/${d.id}` },
        h('strong', null, 'Offenes Training: ', d.session_name), h('span', { class: 'muted' }, relDay(d.day) + ' · weiter →')));
    }
    if (hevyActive(ctx)) return wrap;

    const [plan, workouts, exMapP] = await Promise.all([activePlan(ctx.client.id), recentWorkouts(ctx.client.id, addDays(today(), -60), 60), exerciseMap()]);
    const next = nextSession(plan, workouts);

    if (!plan) {
      wrap.append(card('Krafttraining', empty('Max erstellt gerade deinen Trainingsplan.')));
    } else {
      const wk = currentWeek(plan);
      const thisWeek = workouts.filter((w) => w.day >= weekStart(today()) && w.plan_id === plan.id).length;
      wrap.append(card(plan.name,
        h('p', { class: 'muted small' }, [
          plan.per_week ? `Diese Woche ${thisWeek}/${plan.per_week}` : null,
          wk ? `Woche ${wk}${plan.weeks ? '/' + plan.weeks : ''}` : null,
          wk && plan.deload_week === wk ? 'Deload-Woche: weniger Volumen, leichter' : null
        ].filter(Boolean).join(' · ')),
        plan.notes ? h('p', { class: 'hint' }, plan.notes) : null,
        plan.sessions.map((s) => h('div', { class: 'list-row' + (next?.key === s.key ? ' highlight' : '') },
          h('div', null, h('strong', null, s.key, ' · ', s.name), next?.key === s.key ? badge('als Nächstes', 'accent') : null,
            h('div', { class: 'muted small' }, `${s.exercises.length} Übung${s.exercises.length === 1 ? '' : 'en'}`)),
          h('button', { type: 'button', class: next?.key === s.key ? '' : 'secondary', onclick: () => startWorkout(ctx, plan, s) },
            next?.key === s.key ? 'Starten' : 'Diese starten'))),
        h('p', { class: 'muted small' }, '„Diese starten“ = Training verschieben/tauschen.')));
    }
    if (ctx.client.unlocks?.includes('free_training') || ctx.role === 'coach') {
      wrap.append(h('button', { type: 'button', class: 'secondary', onclick: () => startWorkout(ctx, plan, null, 'free') }, '+ Freies Training'));
    }

    // history
    const hist = card('Letzte Trainings');
    if (!workouts.length) hist.append(empty('Noch keine Trainings.'));
    const exMap = await exerciseMap();
    workouts.slice(0, 12).forEach((w) => hist.append(h('button', {
      type: 'button', class: 'list-row plain', onclick: async () => modal(w.session_name || 'Training', await workoutDetails(w, exMap))
    }, h('div', null, h('strong', null, w.session_name || 'Training'), w.pain ? ' ' : '',
      h('div', { class: 'muted small' }, [relDay(w.day), w.effort ? `Anstrengung ${w.effort}/10` : null, w.with_coach ? 'mit Max' : null].filter(Boolean).join(' · '))),
    h('span', { class: 'chev' }, icon('chevron', { size: 17 })))));
    wrap.append(hist);

    // tested 1RM entry
    if (ctx.role === 'client') {
      wrap.append(h('button', { type: 'button', class: 'link-btn', onclick: () => addTestedMax(ctx) }, '+ Getestetes 1RM eintragen'));
    }
    return wrap;
  },

  async analysis(ctx) {
    const exMap = await exerciseMap();
    const workouts = (await recentWorkouts(ctx.client.id, ctx.from, 500)).filter((w) => w.day <= ctx.to);
    const sets = await setsForWorkouts(workouts.map((w) => w.id));
    const maxes = await testedMaxes(ctx.client.id);
    const plan = await activePlan(ctx.client.id);
    const dayOf = new Map(workouts.map((w) => [w.id, w.day]));
    const wrap = h('div');

    // frequency + plan adherence per week
    const weeks = [...new Set(range(ctx.from, ctx.to).map(weekStart))];
    const perWeek = weeks.map((wk) => ({ d: wk, v: workouts.filter((w) => weekStart(w.day) === wk).length }));
    const planned = plan?.per_week || null;
    const doneWeeks = perWeek.filter((p) => p.d < weekStart(today()));
    const adherence = planned && doneWeeks.length ? doneWeeks.reduce((a, p) => a + Math.min(p.v, planned), 0) / (planned * doneWeeks.length) : null;

    wrap.append(card('Training',
      kpiRow(
        kpi('Trainings', String(workouts.length), { sub: 'im Zeitraum' }),
        kpi('Planerfüllung', adherence != null ? fmtNum(adherence * 100) + ' %' : '–', { sub: planned ? `Ziel ${planned}×/Woche` : 'kein Plan' }),
        kpi('Ø Anstrengung', (() => { const e = workouts.filter((w) => w.effort); return e.length ? fmtNum(e.reduce((a, w) => a + w.effort, 0) / e.length, 1) : '–'; })())
      ),
      chart({ from: weeks[0], to: weeks[weeks.length - 1] || ctx.to, series: [{ label: 'Trainings/Woche', points: perWeek, type: 'bar', digits: 0 }], band: planned ? { min: planned, max: planned } : null, zero: true })));

    // weekly volume per muscle group (last 7 days)
    const lastWeekSets = sets.filter((s) => dayOf.get(s.workout_id) >= addDays(today(), -6));
    const vol = volumeByMuscle(lastWeekSets, exMap);
    const maxVol = Math.max(20, ...vol.map((v) => v[1]));
    wrap.append(card('Sätze pro Muskelgruppe (7 Tage)',
      vol.length ? vol.map(([m, v]) => h('div', { class: 'macro' },
        h('div', { class: 'macro-head' }, h('span', null, m), h('span', { class: 'muted' }, fmtNum(v, v % 1 ? 1 : 0) + ' Sätze')),
        meter(v / maxVol, ctx.role === 'coach' ? (v < 10 ? 'warn' : v <= 20 ? 'ok' : 'bad') : 'accent'))) : empty('Keine Sätze in den letzten 7 Tagen.'),
      ctx.role === 'coach' ? h('p', { class: 'hint muted' }, 'Orientierung: ca. 10–20 harte Sätze/Woche (MEV–MAV), Nebenmuskel zählt ½.') : null));

    // performance per exercise (e1RM)
    const exIds = [...new Set(sets.filter((s) => s.set_type !== 'warmup').map((s) => s.exercise_id))];
    const perf = card('Leistung pro Übung');
    if (!exIds.length) perf.append(empty('Noch keine Daten.'));
    else {
      const sel = select(exIds.map((id) => [id, exMap.get(id)?.name || id]).sort((a, b) => a[1].localeCompare(b[1])), exIds[0]);
      const out = h('div');
      const draw = () => {
        clear(out);
        const id = sel.value;
        const ex = exMap.get(id);
        const best = new Map();
        for (const s of sets) {
          if (s.exercise_id !== id || s.set_type === 'warmup') continue;
          const d = dayOf.get(s.workout_id);
          const v = ex?.tracking_type === 'weight_reps' || ex?.tracking_type === 'bodyweight_plus' ? e1rm(Number(s.weight_kg), s.reps)
            : ex?.tracking_type === 'time' ? s.seconds : ex?.tracking_type === 'distance' ? Number(s.distance_m) : s.reps;
          if (v != null && (!best.has(d) || v > best.get(d))) best.set(d, v);
        }
        const pts = [...best.entries()].map(([d, v]) => ({ d, v }));
        const tested = maxes.filter((m) => m.exercise_id === id).map((m) => ({ d: m.day, v: Number(m.weight_kg) }));
        const unit = ex?.tracking_type === 'time' ? 's' : ex?.tracking_type === 'distance' ? 'm' : ['weight_reps', 'bodyweight_plus'].includes(ex?.tracking_type) ? 'kg' : 'Wdh';
        const lastTested = tested[tested.length - 1];
        out.append(
          kpiRow(
            kpi(lastTested ? '1RM (getestet)' : unit === 'kg' ? 'geschätztes 1RM' : 'Bestwert', lastTested ? fmtNum(lastTested.v, 1) : pts.length ? fmtNum(Math.max(...pts.map((p) => p.v)), 1) : '–', { unit, sub: lastTested ? fmtShort(lastTested.d) : unit === 'kg' ? 'Epley, bis 10 Wdh.' : '' })),
          chart({
            from: ctx.from, to: ctx.to, unit,
            series: [
              { label: unit === 'kg' ? 'geschätzt' : 'Bestwert', points: pts, cls: 'accent', digits: 1, maxGap: 999 },
              ...(tested.length ? [{ label: 'getestet', points: tested, type: 'dots', cls: 'ok', digits: 1 }] : [])
            ]
          }));
      };
      sel.addEventListener('change', draw);
      draw();
      perf.append(sel, out);
    }
    wrap.append(perf);
    return wrap;
  },

  async coach(ctx) {
    const plan = await activePlan(ctx.client.id);
    const versions = await q(from('training_plans').select('id, name, version, created_at, is_active').eq('client_id', ctx.client.id).order('created_at', { ascending: false }));
    const workouts = await recentWorkouts(ctx.client.id, addDays(today(), -60), 40);
    const exMap = await exerciseMap();

    const wrap = card('Trainingsplan',
      plan ? h('div', null,
        h('p', null, h('strong', null, plan.name), ` · Version ${plan.version} · seit ${fmt(plan.start_date || plan.created_at)}`),
        h('p', { class: 'muted small' }, plan.sessions.map((s) => `${s.key}: ${s.name} (${s.exercises.length})`).join(' · '))) : empty('Kein aktiver Plan.'),
      h('div', { class: 'row-actions wrap' },
        plan ? h('a', { class: 'button secondary', href: '#/c/plan/' + plan.id }, 'Plan bearbeiten') : null,
        h('button', {
          type: 'button', class: 'secondary', onclick: async () => {
            const tid = await chooseTemplate();
            if (!tid) return;
            if (plan && !await confirmDialog('Aktuellen Plan durch die Vorlage ersetzen? Der alte Plan bleibt im Verlauf.')) return;
            try { await assignTemplate(ctx.client, tid); toast('Plan zugewiesen – Kunde wird benachrichtigt'); ctx.refresh(); } catch (e) { showError(e); }
          }
        }, plan ? 'Andere Vorlage zuweisen' : 'Vorlage zuweisen'),
        !plan ? h('a', { class: 'button secondary', href: `#/c/plan/neu?client=${ctx.client.id}` }, 'Eigenen Plan erstellen') : null,
        h('button', { type: 'button', class: 'secondary', onclick: () => startWorkout(ctx, plan, null, 'free', { withCoach: true }) }, 'Live-Training (PT) starten')),
      versions.length > 1 ? h('details', null, h('summary', null, `Versionen (${versions.length})`),
        versions.map((v) => h('p', { class: 'muted small' }, `${v.name} · V${v.version} · ${fmt(v.created_at)}${v.is_active ? ' · aktiv' : ''}`))) : null);

    // coming from a PT appointment: log the session live, linked to the appointment
    const appointmentId = ctx.query?.pt || null;
    if (appointmentId) {
      wrap.prepend(h('div', { class: 'card accent-border' },
        h('strong', null, 'PT-Termin: Training live loggen'),
        h('div', { class: 'row-actions wrap' },
          (plan?.sessions || []).map((s) => h('button', { type: 'button', onclick: () => startWorkout(ctx, plan, s, 'plan', { withCoach: true, appointmentId }) }, `${s.key}: ${s.name}`)),
          h('button', { type: 'button', class: 'secondary', onclick: () => startWorkout(ctx, plan, null, 'free', { withCoach: true, appointmentId }) }, 'Frei loggen'))));
    } else if (plan) {
      wrap.append(h('div', { class: 'row-actions wrap' }, plan.sessions.map((s) =>
        h('button', { type: 'button', class: 'link-btn', onclick: () => startWorkout(ctx, plan, s, 'plan', { withCoach: true }) }, `PT: ${s.key} starten`))));
    }

    const hist = card('Letzte Trainings');
    if (!workouts.length) hist.append(empty('Noch keine Trainings.'));
    workouts.slice(0, 15).forEach((w) => hist.append(h('button', {
      type: 'button', class: 'list-row plain', onclick: async () => modal(w.session_name || 'Training', await workoutDetails(w, exMap))
    }, h('div', null, h('strong', null, w.session_name || 'Training'), w.pain ? ' ' : '', w.with_coach ? ' ' : '',
      h('div', { class: 'muted small' }, [relDay(w.day), w.effort ? `Anstrengung ${w.effort}/10` : null, w.kind === 'free' ? 'frei' : null].filter(Boolean).join(' · '))),
    h('span', { class: 'chev' }, icon('chevron', { size: 17 })))));
    const frag = document.createDocumentFragment();
    frag.append(wrap, hist);
    return frag;
  },

  async summary(ctx, fromDay, toDay) {
    const workouts = (await recentWorkouts(ctx.client.id, fromDay, 50)).filter((w) => w.day <= toDay);
    const plan = await activePlan(ctx.client.id);
    return [{ label: 'Krafttrainings', value: `${workouts.length}${plan?.per_week ? ' / ' + plan.per_week + ' geplant' : ''}${workouts.some((w) => w.pain) ? ' · Beschwerden gemeldet' : ''}` }];
  },

  routes: [
    { path: '/training/kraft/:wid', role: 'client', render: (el, p, qy, app) => renderLogger(el, { client: app.client, settings: app.settings, workoutId: p.wid, backHref: '#/training', role: 'client' }) },
    { path: '/c/kunde/:cid/training/:wid', role: 'coach', render: async (el, p, qy, app) => { const c = await app.loadClient(p.cid); return renderLogger(el, { client: c, settings: app.settings, workoutId: p.wid, backHref: `#/c/kunde/${p.cid}?tab=training`, role: 'coach' }); } },
    { path: '/c/plaene', role: 'coach', nav: { label: 'Pläne', icon: '' }, render: (el) => renderPlanList(el) },
    { path: '/c/plan/:id', role: 'coach', render: (el, p, qy) => renderPlanEditor(el, p, qy) }
  ]
};

async function addTestedMax(ctx) {
  const exMap = await exerciseMap();
  const opts = [...exMap.values()].filter((e) => e.tracking_type === 'weight_reps' && e.active).map((e) => [e.id, e.name]);
  const sel = select(opts, opts[0]?.[0]);
  const w = input({ type: 'number', step: '0.5', inputmode: 'decimal', placeholder: 'kg' });
  const d = input({ type: 'date', value: today(), max: today(), min: addDays(today(), -3) });
  await modal('Getestetes 1RM', h('div', null, field('Übung', sel), field('Gewicht (1 saubere Wiederholung)', w), field('Datum', d),
    h('p', { class: 'hint muted' }, 'Nur echte Tests eintragen. Der Wert hat Vorrang vor der Schätzung.')), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Speichern', onClick: async () => {
        const kg = parseNum(w.value);
        if (!kg) { toast('Bitte Gewicht eingeben.', 'bad'); return undefined; }
        try { await q(from('tested_maxes').insert({ client_id: ctx.client.id, exercise_id: sel.value, day: d.value, weight_kg: kg })); toast('Gespeichert'); ctx.refresh(); return true; }
        catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}
