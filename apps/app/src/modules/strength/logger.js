// Workout logger (client, or coach during a PT session). Offline-first: every change is
// kept in localStorage; on "Beenden" the workout is pushed (or queued if offline).
import { h, clear, fmtNum, input, select, modal, confirmDialog, toast, showError, rating, textarea, field, parseNum, uuid, backLink } from '../../core/ui.js';
import { today, fmtLong } from '../../core/dates.js';
import { e1rm } from '../../core/metrics.js';
import { exerciseMap, setsForExercises, lastTimeAndBest, saveDraft, loadDraft, dropDraft, queue, syncOutbox, pushWorkout } from './data.js';
import { pickExercise } from './picker.js';

const SET_TYPES = [['normal', 'Satz'], ['warmup', 'Aufwärmen'], ['drop', 'Drop'], ['superset', 'Supersatz']];

function fmtRest(sec) { const m = Math.floor(sec / 60); return `${m}:${String(sec % 60).padStart(2, '0')}`; }

function targetText(t) {
  if (!t) return '';
  const reps = t.rep_min && t.rep_max ? `${t.rep_min}–${t.rep_max}` : (t.rep_max || t.rep_min || '');
  return [t.sets ? `${t.sets} × ${reps || '?'}` : null, t.rir != null ? `RIR ${t.rir}` : null, t.rest_s ? `Pause ${fmtRest(t.rest_s)}` : null].filter(Boolean).join(' · ');
}

function lastText(last, ex) {
  if (!last?.last?.length) return 'Letztes Mal: –';
  return 'Letztes Mal: ' + last.last.filter((s) => s.set_type !== 'warmup').map((s) => {
    if (ex?.tracking_type === 'time') return `${s.seconds}s`;
    if (ex?.tracking_type === 'distance') return `${fmtNum(s.distance_m)} m`;
    if (ex?.tracking_type === 'bodyweight_reps') return `${s.reps}`;
    return `${fmtNum(s.weight_kg, s.weight_kg % 1 ? 1 : 0)}×${s.reps ?? '?'}`;
  }).join(', ');
}

/** Double progression: all normal sets reached the top of the rep range last time */
function progressionHint(last, target) {
  if (!last?.last?.length || !target?.rep_max) return null;
  const normal = last.last.filter((s) => s.set_type === 'normal' || !s.set_type);
  if (normal.length && normal.length >= (target.sets || 1) && normal.every((s) => (s.reps || 0) >= target.rep_max)) {
    return 'Obere Grenze letztes Mal in allen Sätzen erreicht → Gewicht leicht erhöhen.';
  }
  return null;
}

/** Create a new workout draft from a plan session (or empty for free training). */
export function newWorkout({ client, plan, session, kind = 'plan', withCoach = false, appointmentId = null }) {
  const w = {
    id: uuid(), client_id: client.id, plan_id: plan?.id || null,
    session_key: session?.key || null, session_name: session?.name || (kind === 'free' ? 'Freies Training' : 'Training'),
    day: today(), started_at: new Date().toISOString(), finished_at: null, kind,
    with_coach: withCoach, appointment_id: appointmentId,
    effort: null, pain: false, pain_location: '', note: '',
    exercises: (session?.exercises || []).map((pe) => ({
      exercise_id: pe.exercise_id,
      target: { sets: pe.sets, rep_min: pe.rep_min, rep_max: pe.rep_max, rir: pe.rir, rest_s: pe.rest_s, note: pe.note, group: pe.group },
      sets: [
        ...Array.from({ length: pe.warmup_sets || 0 }, () => ({ id: uuid(), set_type: 'warmup', done: false })),
        ...Array.from({ length: pe.sets || 1 }, () => ({ id: uuid(), set_type: pe.group ? 'superset' : 'normal', done: false }))
      ]
    }))
  };
  saveDraft(w);
  return w;
}

/**
 * Render the logger.
 * opts: { client, settings, workoutId, backHref, role }
 */
export async function renderLogger(el, { client, settings, workoutId, backHref, role }) {
  let w = loadDraft(workoutId);
  if (!w) {
    el.append(backLink(backHref), h('p', { class: 'error' }, 'Dieses Training ist auf diesem Gerät nicht (mehr) gespeichert.'));
    return;
  }
  const exMap = await exerciseMap();
  const thresholds = settings.thresholds;
  let history = new Map();
  const loadHistory = async () => {
    try {
      const sets = await setsForExercises(client.id, [...new Set(w.exercises.map((e) => e.exercise_id))]);
      history = lastTimeAndBest(sets, w.id);
      w.history = Object.fromEntries([...history.entries()].map(([k, v]) => [k, { last: v.last, best: v.best }]));
      saveDraft(w);
    } catch (e) {
      // offline: use what was cached when the workout started
      history = new Map(Object.entries(w.history || {}));
    }
  };
  await loadHistory();

  const persist = () => { saveDraft(w); };

  // ---------- rest timer ----------
  let restEnd = null, restTick = null;
  const restBar = h('div', { class: 'rest-bar', hidden: true });
  const startRest = (sec) => {
    if (!sec) return;
    restEnd = Date.now() + sec * 1000;
    restBar.hidden = false;
    clearInterval(restTick);
    const tick = () => {
      const left = Math.round((restEnd - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(restTick);
        restBar.textContent = 'Pause vorbei – nächster Satz!';
        navigator.vibrate?.([200, 100, 200]);
        setTimeout(() => { restBar.hidden = true; }, 4000);
        return;
      }
      clear(restBar).append(h('span', null, 'Pause ', h('strong', null, fmtRest(left))),
        h('button', { type: 'button', class: 'link-btn', onclick: () => { restEnd += 30000; } }, '+30 s'),
        h('button', { type: 'button', class: 'link-btn', onclick: () => { clearInterval(restTick); restBar.hidden = true; } }, 'Überspringen'));
    };
    tick();
    restTick = setInterval(tick, 500);
  };

  // ---------- rendering ----------
  const list = h('div', { class: 'logger-list' });
  const elapsed = h('span', { class: 'muted' });
  const elapsedTick = setInterval(() => {
    const m = Math.floor((Date.now() - new Date(w.started_at)) / 60000);
    elapsed.textContent = `${m} min`;
  }, 1000);

  const renderSetRow = (exEntry, set, idx, ex) => {
    const tt = ex?.tracking_type || 'weight_reps';
    const last = history.get(exEntry.exercise_id);
    const normalIdx = exEntry.sets.filter((s, i) => i < idx && s.set_type !== 'warmup').length;
    const lastSet = set.set_type !== 'warmup' ? last?.last?.filter((s) => s.set_type !== 'warmup')[normalIdx] : null;

    const warn = h('small', { class: 'warn-text' });
    const pr = h('span', { class: 'pr', hidden: true }, 'PR!');
    const check = () => {
      warn.textContent = '';
      if (set.weight != null && lastSet?.weight_kg && tt === 'weight_reps') {
        const diff = Math.abs(set.weight - lastSet.weight_kg) / lastSet.weight_kg * 100;
        if (diff > thresholds.set_jump_pct) warn.textContent = `${fmtNum(diff)} % anders als letztes Mal – Tippfehler?`;
      }
      const est = e1rm(set.weight, set.reps);
      pr.hidden = !(set.done && set.set_type !== 'warmup' && est && last?.best && est > last.best + 0.01);
    };

    const num = (key, props) => {
      const shown = set[key] != null && key === 'weight' && tt === 'assisted' ? Math.abs(set[key]) : set[key];
      const inp = input({ type: 'number', inputmode: props.step?.includes('.') ? 'decimal' : 'numeric', class: 'set-in', value: shown ?? '', ...props });
      inp.addEventListener('input', () => {
        const v = parseNum(inp.value);
        // assistance is stored as negative weight
        set[key] = v != null && key === 'weight' && tt === 'assisted' ? -Math.abs(v) : v;
        check(); persist();
      });
      return inp;
    };

    const fields = [];
    if (tt === 'weight_reps' || tt === 'bodyweight_plus' || tt === 'assisted' || tt === 'distance') {
      fields.push(num('weight', {
        step: '0.5', 'aria-label': tt === 'assisted' ? 'Assistenz kg' : tt === 'bodyweight_plus' ? 'Zusatzgewicht kg' : 'Gewicht kg',
        placeholder: lastSet?.weight_kg != null ? fmtNum(Math.abs(lastSet.weight_kg), 1) : (tt === 'assisted' ? 'Assist.' : 'kg')
      }));
    }
    if (tt === 'time') fields.push(num('seconds', { step: '1', 'aria-label': 'Sekunden', placeholder: lastSet?.seconds ?? 'Sek.' }));
    else if (tt === 'distance') fields.push(num('distance', { step: '1', 'aria-label': 'Meter', placeholder: lastSet?.distance_m ?? 'm' }));
    else fields.push(num('reps', { step: '1', 'aria-label': 'Wiederholungen', placeholder: lastSet?.reps ?? 'Wdh' }));
    fields.push(num('rir', { step: '0.5', 'aria-label': 'RIR', placeholder: exEntry.target?.rir ?? 'RIR', class: 'set-in rir' }));

    const type = select(SET_TYPES, set.set_type || 'normal', { class: 'set-type', 'aria-label': 'Satzart' });
    type.addEventListener('change', () => { set.set_type = type.value; persist(); render(); });

    const side = ex?.unilateral ? select([['', 'L/R'], ['left', 'L'], ['right', 'R']], set.side || '', { class: 'set-side', 'aria-label': 'Seite' }) : null;
    side?.addEventListener('change', () => { set.side = side.value || null; persist(); });

    const done = h('button', {
      type: 'button', class: 'set-done' + (set.done ? ' on' : ''), 'aria-label': 'Satz erledigt',
      onclick: () => {
        set.done = !set.done;
        done.classList.toggle('on', set.done);
        check(); persist();
        if (set.done) startRest(set.set_type === 'warmup' ? 60 : exEntry.target?.rest_s || 120);
      }
    }, '✓');
    check();

    return h('div', { class: 'set-row' + (set.set_type === 'warmup' ? ' warmup' : '') },
      h('span', { class: 'set-no' }, set.set_type === 'warmup' ? 'W' : String(normalIdx + 1)),
      type, side, fields, done, pr, warn);
  };

  const renderExercise = (exEntry, i) => {
    const ex = exMap.get(exEntry.exercise_id);
    const last = history.get(exEntry.exercise_id);
    const hint = progressionHint(last, exEntry.target);
    const block = h('section', { class: 'card exercise-block' + (exEntry.target?.group ? ' superset' : '') },
      h('div', { class: 'ex-head' },
        h('div', null,
          h('h3', null, exEntry.target?.group ? `${exEntry.target.group} · ` : '', ex?.name || exEntry.exercise_id),
          h('small', { class: 'muted' }, targetText(exEntry.target))),
        h('div', { class: 'row-actions' },
          ex?.video_url ? h('a', { class: 'link-btn', href: ex.video_url, target: '_blank', rel: 'noopener noreferrer' }, 'Video') : null,
          h('button', {
            type: 'button', class: 'link-btn', title: 'Gerät belegt? Übung tauschen',
            onclick: async () => {
              const pick = await pickExercise({ suggest: [ex?.alt1, ex?.alt2].filter(Boolean) });
              if (!pick) return;
              exEntry.exercise_id = pick.id;
              persist(); await loadHistory(); render();
            }
          }, 'Tauschen'))),
      h('p', { class: 'muted small' }, lastText(last, ex)),
      hint ? h('p', { class: 'hint ok-text' }, '↑ ', hint) : null,
      exEntry.target?.note ? h('p', { class: 'hint' }, exEntry.target.note) : null,
      ex?.hint ? h('details', { class: 'small' }, h('summary', null, 'Technik-Hinweis'), h('p', null, ex.hint)) : null,
      exEntry.sets.map((s, idx) => renderSetRow(exEntry, s, idx, ex)),
      h('div', { class: 'row-actions' },
        h('button', { type: 'button', class: 'link-btn', onclick: () => { exEntry.sets.push({ id: uuid(), set_type: 'normal', done: false }); persist(); render(); } }, '+ Satz'),
        exEntry.sets.length ? h('button', {
          type: 'button', class: 'link-btn', onclick: () => {
            const idx = exEntry.sets.map((s) => s.done).lastIndexOf(false);
            if (idx >= 0) { exEntry.sets.splice(idx, 1); persist(); render(); }
          }
        }, '− Satz') : null,
        w.kind === 'free' || role === 'coach' ? h('button', {
          type: 'button', class: 'link-btn danger', onclick: async () => {
            if (await confirmDialog('Übung aus diesem Training entfernen?')) { w.exercises.splice(i, 1); persist(); render(); }
          }
        }, 'Entfernen') : null));
    return block;
  };

  const render = () => {
    clear(list);
    if (!w.exercises.length) list.append(h('p', { class: 'muted' }, 'Noch keine Übung. Füge unten eine hinzu.'));
    w.exercises.forEach((e, i) => list.append(renderExercise(e, i)));
  };

  const finish = async () => {
    const open = w.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
    const done = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
    if (!done && !await confirmDialog('Noch kein Satz abgehakt. Trotzdem beenden?')) return;
    const eff = rating(w.effort, { max: 10 });
    let pain = !!w.pain;
    const painLoc = input({ value: w.pain_location || '', placeholder: 'Wo? z. B. linke Schulter', maxlength: 200, hidden: !pain });
    const painBtn = h('div', { class: 'segmented' });
    const renderPain = () => {
      clear(painBtn).append(
        h('button', { type: 'button', class: !pain ? 'on' : '', onclick: () => { pain = false; painLoc.hidden = true; renderPain(); } }, 'Nein'),
        h('button', { type: 'button', class: pain ? 'on' : '', onclick: () => { pain = true; painLoc.hidden = false; renderPain(); } }, 'Ja'));
    };
    renderPain();
    const note = textarea({ value: w.note || '', maxlength: 2000, placeholder: role === 'coach' ? 'Notiz (Technik, Befinden …)' : 'Wie lief es? (optional)' });
    const ok = await modal('Training beenden', h('div', null,
      open ? h('p', { class: 'muted' }, `${open} Satz/Sätze nicht abgehakt – werden nicht gespeichert.`) : null,
      field('Anstrengung (1 = sehr leicht, 10 = maximal)', eff),
      field('Schmerzen oder Beschwerden?', painBtn), painLoc,
      field('Notiz', note)), [
      { label: 'Weiter trainieren', kind: 'secondary', value: false },
      { label: 'Speichern', value: true }
    ]);
    if (!ok) return;
    w.effort = eff.value; w.pain = pain; w.pain_location = pain ? painLoc.value.trim() : ''; w.note = note.value.trim();
    w.finished_at = new Date().toISOString();
    persist();
    queue(w.id);
    try {
      await pushWorkout(w);
      dropDraft(w.id);
      await syncOutbox();
      toast(pain ? 'Gespeichert – Max wurde über die Beschwerden informiert.' : 'Training gespeichert 💪');
    } catch (e) {
      toast('Offline gespeichert – wird synchronisiert, sobald du Netz hast.', 'warn');
    }
    location.hash = backHref;
  };

  const discard = async () => {
    if (!await confirmDialog('Training verwerfen? Alle Eingaben gehen verloren.', { ok: 'Verwerfen', danger: true })) return;
    dropDraft(w.id);
    location.hash = backHref;
  };

  el.append(
    backLink(backHref),
    h('header', { class: 'page-head' },
      h('div', null, h('h1', null, w.session_name), h('p', { class: 'muted' }, fmtLong(w.day), ' · ', elapsed, w.with_coach ? ' · mit Max' : '', role === 'coach' ? ` · ${client.first_name}` : ''))),
    list,
    h('button', {
      type: 'button', class: 'secondary', onclick: async () => {
        const pick = await pickExercise();
        if (!pick) return;
        w.exercises.push({ exercise_id: pick.id, target: {}, sets: [{ id: uuid(), set_type: 'normal', done: false }] });
        persist(); await loadHistory(); render();
      }
    }, '+ Übung hinzufügen'),
    h('button', { type: 'button', onclick: finish }, 'Training beenden'),
    h('button', { type: 'button', class: 'link-btn danger center-block', onclick: discard }, 'Training verwerfen'),
    restBar);
  render();

  return () => { clearInterval(elapsedTick); clearInterval(restTick); };
}
