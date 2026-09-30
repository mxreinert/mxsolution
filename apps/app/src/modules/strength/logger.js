// Workout logger (client, or coach during a PT session). Offline-first: every change is
// kept in localStorage; on "Beenden" the workout is pushed (or queued if offline).
import { h, clear, fmtNum, input, select, modal, confirmDialog, toast, showError, errorText, rating, textarea, field, parseNum, uuid, backLink, srow, switchInput, tile, icon } from '../../core/ui.js';
import { today, fmtLong } from '../../core/dates.js';
import { e1rm } from '../../core/metrics.js';
import { exerciseMap, setsForExercises, lastTimeAndBest, saveDraft, loadDraft, dropDraft, queue, syncOutbox, pushWorkout, isNetworkError, rememberSyncError } from './data.js';
import { pickExercise } from './picker.js';
import { clientThresholds } from '../../core/settings.js';

const SET_TYPES = [['normal', 'Satz'], ['warmup', 'Aufw.'], ['drop', 'Drop'], ['superset', 'Super']];

function fmtRest(sec) { const m = Math.floor(sec / 60); return `${m}:${String(sec % 60).padStart(2, '0')}`; }

function targetText(t) {
  if (!t) return '';
  const reps = t.rep_min && t.rep_max ? `${t.rep_min}–${t.rep_max}` : (t.rep_max || t.rep_min || '');
  return [t.sets ? `${t.sets} × ${reps || '?'}` : null, t.rir != null ? `RIR ${t.rir}` : null, t.rest_s ? `Pause ${fmtRest(t.rest_s)}` : null].filter(Boolean).join(' · ');
}

function lastText(last, ex, otherGym) {
  const label = otherGym ? 'Letztes Mal im Stamm-Gym: ' : 'Letztes Mal: ';
  if (!last?.last?.length) return label + '–';
  return label + last.last.filter((s) => s.set_type !== 'warmup').map((s) => {
    if (ex?.tracking_type === 'time') return `${s.seconds}s`;
    if (ex?.tracking_type === 'distance') return `${fmtNum(s.distance_m)} m`;
    if (ex?.tracking_type === 'bodyweight_reps') return `${s.reps}`;
    return `${fmtNum(s.weight_kg, s.weight_kg % 1 ? 1 : 0)}×${s.reps ?? '?'}`;
  }).join(', ');
}

/** Double progression: all normal sets reached the top of the rep range last time */
function progressionHint(last, target) {
  if (!last?.last?.length || !target?.rep_max) return null;
  const normal = last.last.filter((s) => s.set_type !== 'warmup' && s.set_type !== 'drop');
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
    effort: null, pain: false, pain_location: '', note: '', other_gym: false, gym_name: '',
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
  const thresholds = clientThresholds(settings, client);
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

  // ---------- rest timer (bottom sheet like Hevy) ----------
  let restEnd = null, restTotal = 0, restTick = null;
  const restTime = h('strong', { class: 'rest-time' });
  const restFill = h('span');
  const restBar = h('div', { class: 'rest-sheet', hidden: true },
    h('div', { class: 'rest-progress' }, restFill),
    h('div', { class: 'rest-controls' },
      h('button', { type: 'button', class: 'rest-adj', onclick: () => { restEnd -= 15000; restTotal = Math.max(15, restTotal - 15); } }, '−15'),
      restTime,
      h('button', { type: 'button', class: 'rest-adj', onclick: () => { restEnd += 15000; restTotal += 15; } }, '+15'),
      h('button', { type: 'button', class: 'rest-skip', onclick: () => { clearInterval(restTick); restBar.hidden = true; } }, 'Überspringen')));
  const startRest = (sec) => {
    if (!sec) return;
    restTotal = sec;
    restEnd = Date.now() + sec * 1000;
    restBar.hidden = false;
    clearInterval(restTick);
    const tick = () => {
      const left = Math.round((restEnd - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(restTick);
        restTime.textContent = 'Los geht’s!';
        restFill.style.width = '0%';
        navigator.vibrate?.([200, 100, 200]);
        setTimeout(() => { restBar.hidden = true; }, 2500);
        return;
      }
      restTime.textContent = fmtRest(left);
      restFill.style.width = `${Math.min(100, (left / restTotal) * 100)}%`;
    };
    tick();
    restTick = setInterval(tick, 250);
  };

  // ---------- stats bar ----------
  const statDur = h('strong', { class: 'stat-accent' });
  const statVol = h('strong');
  const statSets = h('strong');
  const updateStats = () => {
    let vol = 0, n = 0;
    for (const e of w.exercises) {
      for (const st of e.sets) {
        if (!st.done) continue;
        n += 1;
        if (st.set_type !== 'warmup' && st.weight > 0 && st.reps) vol += st.weight * st.reps;
      }
    }
    statVol.textContent = `${fmtNum(vol)} kg`;
    statSets.textContent = String(n);
  };
  const elapsedTick = setInterval(() => {
    const sec = Math.floor((Date.now() - new Date(w.started_at)) / 1000);
    const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
    statDur.textContent = hh ? `${hh} h ${mm} min` : `${mm} min ${ss} s`;
  }, 1000);

  // ---------- rendering ----------
  const list = h('div', { class: 'logger-list' });
  const TYPE_MARK = { warmup: 'W', drop: 'D', superset: 'S' };

  /** columns for this exercise's tracking type */
  const columnsFor = (tt) => {
    const cols = [];
    if (tt === 'weight_reps' || tt === 'distance') cols.push(['weight', 'KG']);
    if (tt === 'bodyweight_plus') cols.push(['weight', '+KG']);
    if (tt === 'assisted') cols.push(['weight', 'HILFE']);
    if (tt === 'time') cols.push(['seconds', 'SEK']);
    else if (tt === 'distance') cols.push(['distance', 'M']);
    else cols.push(['reps', 'WDH']);
    cols.push(['rir', 'RIR']);
    return cols;
  };

  const prevText = (ls, tt) => {
    if (!ls) return '–';
    if (tt === 'time') return `${ls.seconds ?? '?'} s`;
    if (tt === 'distance') return `${fmtNum(ls.distance_m)} m`;
    if (tt === 'bodyweight_reps') return `${ls.reps ?? '?'}`;
    return `${fmtNum(Math.abs(ls.weight_kg), ls.weight_kg % 1 ? 1 : 0)} kg × ${ls.reps ?? '?'}`;
  };

  const renderSetRow = (exEntry, set, idx, ex, grid) => {
    const tt = ex?.tracking_type || 'weight_reps';
    const last = history.get(exEntry.exercise_id);
    const normalIdx = exEntry.sets.filter((st, i) => i < idx && st.set_type !== 'warmup').length;
    const lastSet = set.set_type !== 'warmup' ? last?.last?.filter((st) => st.set_type !== 'warmup')[normalIdx] : null;

    const warn = h('small', { class: 'warn-text hx-warn' });
    const mark = h('span', { class: 'hx-mark' });
    const row = h('div', { class: 'hx-row', style: `grid-template-columns:${grid}` });

    const check = () => {
      warn.textContent = '';
      if (!w.other_gym && set.weight != null && lastSet?.weight_kg && tt === 'weight_reps') {
        const diff = Math.abs(set.weight - lastSet.weight_kg) / lastSet.weight_kg * 100;
        if (diff > thresholds.set_jump_pct) warn.textContent = `${fmtNum(diff)} % anders als letztes Mal – Tippfehler?`;
      }
      const est = e1rm(set.weight, set.reps);
      const isPr = !w.other_gym && set.done && set.set_type !== 'warmup' && est && last?.best && est > last.best + 0.01;
      mark.textContent = isPr ? '🏅' : TYPE_MARK[set.set_type] || String(normalIdx + 1);
      mark.className = 'hx-mark t-' + (isPr ? 'pr' : set.set_type || 'normal');
      row.classList.toggle('done', !!set.done);
      row.classList.toggle('warmup', set.set_type === 'warmup');
    };

    // set number: tap to change the set type (transparent select on top)
    const type = select(SET_TYPES.map(([v, l]) => [v, v === 'normal' ? 'Normaler Satz' : v === 'warmup' ? 'Aufwärmsatz' : v === 'drop' ? 'Dropsatz' : 'Supersatz']),
      set.set_type || 'normal', { class: 'hx-type', 'aria-label': 'Satzart' });
    type.addEventListener('change', () => { set.set_type = type.value; persist(); render(); });
    const setCell = h('label', { class: 'hx-set' }, mark, type);

    const inputs = {};
    const num = (key) => {
      const shown = set[key] != null && key === 'weight' && tt === 'assisted' ? Math.abs(set[key]) : set[key];
      const ph = key === 'weight' ? (lastSet?.weight_kg != null ? fmtNum(Math.abs(lastSet.weight_kg), 1) : '0')
        : key === 'reps' ? (lastSet?.reps ?? exEntry.target?.rep_max ?? '0')
          : key === 'seconds' ? (lastSet?.seconds ?? '0')
            : key === 'distance' ? (lastSet?.distance_m ?? '0') : (exEntry.target?.rir ?? '–');
      const inp = input({ type: 'number', inputmode: key === 'weight' || key === 'rir' ? 'decimal' : 'numeric', step: key === 'weight' || key === 'rir' ? '0.5' : '1', class: 'hx-in', value: shown ?? '', placeholder: String(ph), 'aria-label': key });
      inp.addEventListener('input', () => {
        const v = parseNum(inp.value);
        set[key] = v != null && key === 'weight' && tt === 'assisted' ? -Math.abs(v) : v;
        check(); persist(); updateStats();
      });
      inputs[key] = inp;
      return inp;
    };

    // previous: tap copies last time's values
    const prev = h('button', {
      type: 'button', class: 'hx-prev', disabled: !lastSet,
      onclick: () => {
        if (!lastSet) return;
        if (inputs.weight && lastSet.weight_kg != null) { set.weight = Number(lastSet.weight_kg); inputs.weight.value = Math.abs(set.weight); }
        if (inputs.reps && lastSet.reps != null) { set.reps = lastSet.reps; inputs.reps.value = set.reps; }
        if (inputs.seconds && lastSet.seconds != null) { set.seconds = lastSet.seconds; inputs.seconds.value = set.seconds; }
        if (inputs.distance && lastSet.distance_m != null) { set.distance = Number(lastSet.distance_m); inputs.distance.value = set.distance; }
        check(); persist(); updateStats();
      }
    }, prevText(lastSet, tt));

    const side = ex?.unilateral ? select([['', 'L/R'], ['left', 'L'], ['right', 'R']], set.side || '', { class: 'hx-side', 'aria-label': 'Seite' }) : null;
    side?.addEventListener('change', () => { set.side = side.value || null; persist(); });

    const done = h('button', {
      type: 'button', class: 'hx-check', 'aria-label': 'Satz erledigt',
      onclick: () => {
        // fill empty fields from the placeholder (= last time / target), like Hevy
        if (!set.done) {
          for (const [k, inp] of Object.entries(inputs)) {
            if (k !== 'rir' && set[k] == null && parseNum(inp.placeholder) != null && parseNum(inp.placeholder) !== 0) {
              inp.value = inp.placeholder;
              set[k] = k === 'weight' && tt === 'assisted' ? -Math.abs(parseNum(inp.placeholder)) : parseNum(inp.placeholder);
            }
          }
        }
        set.done = !set.done;
        check(); persist(); updateStats();
        if (set.done) {
          // superset: no rest between the exercises of a group, only after the last one
          const i = w.exercises.indexOf(exEntry);
          const nextSame = exEntry.target?.group && w.exercises[i + 1]?.target?.group === exEntry.target.group;
          if (!nextSame) startRest(set.set_type === 'warmup' ? 60 : exEntry.target?.rest_s ?? 120);
        }
      }
    }, icon('check', { size: 18, stroke: 3 }));

    row.append(setCell, prev, columnsFor(tt).map(([k]) => num(k)), done, side ? h('div', { class: 'hx-extra' }, side) : null, warn);
    check();
    return row;
  };

  const menu = (exEntry, i, ex) => modal(ex?.name || 'Übung', (close) => h('div', { class: 'hx-menu' },
    h('button', {
      type: 'button', class: 'secondary', onclick: async () => {
        close();
        const pick = await pickExercise({ suggest: [ex?.alt1, ex?.alt2].filter(Boolean) });
        if (!pick) return;
        exEntry.exercise_id = pick.id;
        persist(); await loadHistory(); render();
      }
    }, 'Übung tauschen (Gerät belegt?)'),
    ex?.video_url ? h('a', { class: 'button secondary', href: ex.video_url, target: '_blank', rel: 'noopener noreferrer' }, 'Video ansehen') : null,
    ex?.hint ? h('div', { class: 'hint' }, h('strong', null, 'Technik: '), ex.hint) : null,
    h('button', {
      type: 'button', class: 'secondary', onclick: () => {
        const idx = exEntry.sets.map((x) => x.done).lastIndexOf(false);
        if (idx >= 0) { exEntry.sets.splice(idx, 1); persist(); render(); updateStats(); }
        close();
      }
    }, 'Letzten offenen Satz entfernen'),
    w.kind === 'free' || role === 'coach' ? h('button', {
      type: 'button', class: 'secondary danger-btn', onclick: () => { w.exercises.splice(i, 1); persist(); render(); updateStats(); close(); }
    }, 'Übung entfernen') : null));

  const renderExercise = (exEntry, i) => {
    const ex = exMap.get(exEntry.exercise_id);
    const tt = ex?.tracking_type || 'weight_reps';
    const last = history.get(exEntry.exercise_id);
    const hint = w.other_gym ? null : progressionHint(last, exEntry.target);
    const cols = columnsFor(tt);
    const grid = `40px minmax(0,1.5fr) ${cols.map(([k]) => (k === 'rir' ? 'minmax(0,.8fr)' : 'minmax(0,1fr)')).join(' ')} 40px`;
    const rest = exEntry.target?.rest_s ?? 120;
    const group = exEntry.target?.group;

    return h('section', { class: 'hx-ex' + (group ? ' superset' : '') },
      h('div', { class: 'hx-head' },
        tile('dumbbell', 'accent', 34),
        h('div', { class: 'hx-title' },
          h('div', { class: 'hx-name' }, group ? h('span', { class: 'hx-group' }, group) : null, ex?.name || exEntry.exercise_id),
          targetText({ ...exEntry.target, rest_s: null }) ? h('div', { class: 'hx-target' }, 'Ziel: ' + targetText({ ...exEntry.target, rest_s: null })) : null),
        h('button', { type: 'button', class: 'hx-more', 'aria-label': 'Optionen', onclick: () => menu(exEntry, i, ex) }, icon('more', { size: 22 }))),
      exEntry.target?.note ? h('p', { class: 'hx-note' }, exEntry.target.note) : null,
      hint ? h('p', { class: 'hx-hint' }, '↑ ', hint) : null,
      w.other_gym ? h('p', { class: 'hx-note' }, 'Anderes Gym – „Vorher“ ist aus deinem Stamm-Gym.') : null,
      group && w.exercises[i + 1]?.target?.group === group ? h('p', { class: 'hx-rest' }, icon('clock', { size: 16 }), ' Supersatz: direkt weiter zur nächsten Übung')
        : h('p', { class: 'hx-rest' }, icon('clock', { size: 16 }), ` Pause: ${Math.floor(rest / 60)} min ${rest % 60 ? (rest % 60) + ' s' : ''}`.trimEnd()),
      h('div', { class: 'hx-table' },
        h('div', { class: 'hx-row hx-th', style: `grid-template-columns:${grid}` },
          h('span', null, 'SATZ'), h('span', null, 'VORHER'), cols.map(([, l]) => h('span', null, l)), h('span', null, icon('check', { size: 16 }))),
        exEntry.sets.map((st, idx) => renderSetRow(exEntry, st, idx, ex, grid))),
      h('button', { type: 'button', class: 'hx-add', onclick: () => { exEntry.sets.push({ id: uuid(), set_type: group ? 'superset' : 'normal', done: false }); persist(); render(); } }, '+ Satz hinzufügen'));
  };

  const render = () => {
    clear(list);
    if (!w.exercises.length) list.append(h('p', { class: 'muted' }, 'Noch keine Übung. Füge unten eine hinzu.'));
    w.exercises.forEach((e, i) => list.append(renderExercise(e, i)));
    updateStats();
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
      toast(pain ? 'Gespeichert – Max wurde über die Beschwerden informiert.' : 'Training gespeichert ');
    } catch (e) {
      if (isNetworkError(e)) toast('Offline gespeichert – wird synchronisiert, sobald du Netz hast.', 'warn');
      else {
        // server said no (not a connection problem): keep it on the phone and show why
        console.error('workout save failed', e);
        rememberSyncError(e);
        toast('Nicht gespeichert: ' + errorText(e) + ' Das Training bleibt auf dem Handy. Schick Max einen Screenshot unter „Training“.', 'bad');
      }
    }
    location.hash = backHref;
  };

  const discard = async () => {
    if (!await confirmDialog('Training verwerfen? Alle Eingaben gehen verloren.', { ok: 'Verwerfen', danger: true })) return;
    dropDraft(w.id);
    location.hash = backHref;
  };

  // "not my usual gym": other machines/plates -> no comparison with the usual numbers
  const gymName = input({ value: w.gym_name || '', maxlength: 80, placeholder: 'Wo? z. B. FitX Berlin (optional)', hidden: !w.other_gym });
  gymName.addEventListener('input', () => { w.gym_name = gymName.value; persist(); });
  const gymCard = h('section', { class: 'card scard gym-card' },
    srow('Anderes Gym', 'Gewichte zählen dann nicht für Rekorde & Vergleich.',
      switchInput(!!w.other_gym, (v) => { w.other_gym = v; gymName.hidden = !v; persist(); render(); }, 'Anderes Gym'), true),
    gymName);

  el.append(
    h('div', { class: 'hx-top' },
      h('a', { class: 'hx-back', href: '#' + backHref.replace(/^#/, ''), 'aria-label': 'Zurück' }, icon('back', { size: 22 })),
      h('div', { class: 'hx-top-title' }, h('strong', null, w.session_name), h('small', null, [fmtLong(w.day), w.with_coach ? 'mit Max' : null, role === 'coach' ? client.first_name : null].filter(Boolean).join(' · '))),
      h('button', { type: 'button', class: 'hx-finish', onclick: finish }, 'Beenden')),
    h('div', { class: 'hx-stats' },
      h('div', null, h('small', null, 'Dauer'), statDur),
      h('div', null, h('small', null, 'Volumen'), statVol),
      h('div', null, h('small', null, 'Sätze'), statSets)),
    gymCard,
    list,
    h('button', {
      type: 'button', class: 'hx-add-ex', onclick: async () => {
        const pick = await pickExercise();
        if (!pick) return;
        w.exercises.push({ exercise_id: pick.id, target: {}, sets: [{ id: uuid(), set_type: 'normal', done: false }] });
        persist(); await loadHistory(); render();
      }
    }, '+ Übung hinzufügen'),
    h('div', { class: 'hx-bottom' },
      h('button', { type: 'button', class: 'secondary', onclick: finish }, 'Training beenden'),
      h('button', { type: 'button', class: 'link-btn danger center-block', onclick: discard }, 'Training verwerfen')),
    restBar);
  render();

  return () => { clearInterval(elapsedTick); clearInterval(restTick); };
}
