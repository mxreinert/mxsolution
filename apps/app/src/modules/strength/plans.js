// Coach: plan templates + editor. Templates: client_id = null.
// Saving a client's plan creates a new version (history stays intact).
import { h, clear, card, input, select, textarea, field, toast, showError, confirmDialog, empty, pageHead, backLink, parseNum, modal } from '../../core/ui.js';
import { q, from } from '../../core/db.js';
import { fmt } from '../../core/dates.js';
import { exerciseMap } from './data.js';
import { pickExercise } from './picker.js';

const KEYS = 'ABCDEFGHIJ';

export async function renderPlanList(el) {
  const plans = await q(from('training_plans').select('id, name, per_week, sessions, created_at').is('client_id', null).order('name'));
  el.append(
    pageHead('Trainingsplan-Vorlagen', 'Vorlagen können mehreren Kunden zugewiesen werden.',
      h('a', { class: 'button', href: '#/c/plan/neu' }, '+ Neue Vorlage')),
    plans.length ? h('div', { class: 'list' }, plans.map((p) => h('a', { class: 'list-row card-link', href: '#/c/plan/' + p.id },
      h('div', null, h('strong', null, p.name),
        h('div', { class: 'muted small' }, `${p.sessions.length} Einheiten${p.per_week ? ` · ${p.per_week}× pro Woche` : ''}`)),
      h('span', { class: 'chev' }, '›')))) : empty('Noch keine Vorlagen. Lege z. B. „Ganzkörper 3×“, „PPL“ oder „OK/UK“ an.'));
}

/** Assign a template to a client (copy, previous active plan becomes inactive). */
export async function assignTemplate(client, templateId) {
  const tpl = (await q(from('training_plans').select('*').eq('id', templateId)))[0];
  if (!tpl) throw new Error('Vorlage nicht gefunden');
  await q(from('training_plans').update({ is_active: false }).eq('client_id', client.id).eq('is_active', true));
  const row = {
    client_id: client.id, name: tpl.name, template_id: tpl.id, version: 1, is_active: true,
    weeks: tpl.weeks, deload_week: tpl.deload_week, per_week: tpl.per_week, sessions: tpl.sessions,
    notes: tpl.notes, start_date: new Date().toISOString().slice(0, 10)
  };
  return (await q(from('training_plans').insert(row).select()))[0];
}

export async function chooseTemplate() {
  const plans = await q(from('training_plans').select('id, name, sessions').is('client_id', null).order('name'));
  if (!plans.length) { toast('Lege zuerst eine Vorlage unter „Pläne“ an.', 'warn'); return null; }
  return modal('Vorlage zuweisen', (close) => h('div', { class: 'picker-list' },
    plans.map((p) => h('button', { type: 'button', class: 'picker-row', onclick: () => close(p.id) },
      h('strong', null, p.name), h('small', { class: 'muted' }, `${p.sessions.length} Einheiten`)))));
}

export async function renderPlanEditor(el, params, query) {
  const isNew = params.id === 'neu';
  let plan = isNew
    ? { name: '', per_week: 3, weeks: null, deload_week: null, notes: '', sessions: [{ key: 'A', name: 'Einheit A', exercises: [] }], client_id: query.client || null }
    : (await q(from('training_plans').select('*').eq('id', params.id)))[0];
  if (!plan) { el.append(h('p', { class: 'error' }, 'Plan nicht gefunden.')); return; }
  plan = structuredClone(plan);
  const exMap = await exerciseMap();
  const back = plan.client_id ? `#/c/kunde/${plan.client_id}?tab=training` : '#/c/plaene';

  const name = input({ value: plan.name, maxlength: 120, placeholder: 'z. B. Ganzkörper 3×' });
  const perWeek = input({ type: 'number', min: 1, max: 14, value: plan.per_week ?? '' });
  const weeks = input({ type: 'number', min: 1, max: 52, value: plan.weeks ?? '', placeholder: 'optional' });
  const deload = input({ type: 'number', min: 1, max: 52, value: plan.deload_week ?? '', placeholder: 'optional' });
  const notes = textarea({ value: plan.notes || '', maxlength: 4000 });
  const sessionsEl = h('div');

  const numIn = (obj, key, props = {}) => {
    const i = input({ type: 'number', value: obj[key] ?? '', class: 'mini', ...props });
    i.addEventListener('input', () => { obj[key] = parseNum(i.value); });
    return i;
  };

  const renderSessions = () => {
    clear(sessionsEl);
    plan.sessions.forEach((s, si) => {
      const sName = input({ value: s.name, maxlength: 80 });
      sName.addEventListener('input', () => { s.name = sName.value; });
      const rows = s.exercises.map((pe, ei) => {
        const ex = exMap.get(pe.exercise_id);
        const grp = input({ value: pe.group || '', maxlength: 2, class: 'mini', placeholder: '–', 'aria-label': 'Supersatz-Gruppe' });
        grp.addEventListener('input', () => { pe.group = grp.value.trim().toUpperCase() || null; });
        const note = input({ value: pe.note || '', maxlength: 200, placeholder: 'Hinweis (optional)' });
        note.addEventListener('input', () => { pe.note = note.value; });
        const move = (d) => { const j = ei + d; if (j < 0 || j >= s.exercises.length) return; [s.exercises[ei], s.exercises[j]] = [s.exercises[j], s.exercises[ei]]; renderSessions(); };
        return h('div', { class: 'plan-ex' },
          h('div', { class: 'plan-ex-head' },
            h('strong', null, ex?.name || pe.exercise_id),
            h('div', { class: 'row-actions' },
              h('button', { type: 'button', class: 'link-btn', 'aria-label': 'nach oben', onclick: () => move(-1) }, '↑'),
              h('button', { type: 'button', class: 'link-btn', 'aria-label': 'nach unten', onclick: () => move(1) }, '↓'),
              h('button', {
                type: 'button', class: 'link-btn', onclick: async () => {
                  const p = await pickExercise({ suggest: [ex?.alt1, ex?.alt2].filter(Boolean) });
                  if (p) { pe.exercise_id = p.id; renderSessions(); }
                }
              }, 'Tauschen'),
              h('button', { type: 'button', class: 'link-btn danger', onclick: () => { s.exercises.splice(ei, 1); renderSessions(); } }, '✕'))),
          h('div', { class: 'plan-grid' },
            h('label', null, 'Sätze', numIn(pe, 'sets', { min: 1, max: 20 })),
            h('label', null, 'Wdh. von', numIn(pe, 'rep_min', { min: 1, max: 100 })),
            h('label', null, 'bis', numIn(pe, 'rep_max', { min: 1, max: 100 })),
            h('label', null, 'RIR', numIn(pe, 'rir', { min: 0, max: 10, step: '0.5' })),
            h('label', null, 'Pause s', numIn(pe, 'rest_s', { min: 0, max: 900, step: '15' })),
            h('label', null, 'Aufw.', numIn(pe, 'warmup_sets', { min: 0, max: 5 })),
            h('label', null, 'Gruppe', grp)),
          note);
      });
      sessionsEl.append(card(null,
        h('div', { class: 'plan-ex-head' },
          h('div', { class: 'grid2' }, h('span', { class: 'badge' }, s.key), sName),
          plan.sessions.length > 1 ? h('button', {
            type: 'button', class: 'link-btn danger', onclick: async () => {
              if (await confirmDialog(`Einheit „${s.name}“ entfernen?`)) { plan.sessions.splice(si, 1); renderSessions(); }
            }
          }, 'Einheit entfernen') : null),
        rows.length ? rows : h('p', { class: 'muted' }, 'Noch keine Übungen.'),
        h('button', {
          type: 'button', class: 'secondary', onclick: async () => {
            const p = await pickExercise();
            if (!p) return;
            s.exercises.push({ exercise_id: p.id, sets: 3, rep_min: 8, rep_max: 12, rir: 2, rest_s: 120, warmup_sets: 0, group: null, note: '' });
            renderSessions();
          }
        }, '+ Übung')));
    });
  };

  const collect = () => ({
    name: name.value.trim(),
    per_week: parseNum(perWeek.value),
    weeks: parseNum(weeks.value),
    deload_week: parseNum(deload.value),
    notes: notes.value.trim() || null,
    sessions: plan.sessions.map((s, i) => ({ ...s, key: s.key || KEYS[i] }))
  });

  const save = async () => {
    const v = collect();
    if (!v.name) { toast('Bitte einen Namen eingeben.', 'bad'); return; }
    if (v.deload_week && v.weeks && v.deload_week > v.weeks) { toast('Deload-Woche liegt nach dem Planende.', 'bad'); return; }
    try {
      if (isNew && !plan.client_id) {
        const row = (await q(from('training_plans').insert(v).select()))[0];
        toast('Vorlage gespeichert');
        location.hash = '#/c/plan/' + row.id;
      } else if (!plan.client_id) {
        await q(from('training_plans').update(v).eq('id', plan.id));
        toast('Vorlage gespeichert');
      } else {
        // client plan: new version, old one stays in history
        if (plan.id) await q(from('training_plans').update({ is_active: false }).eq('id', plan.id));
        const row = (await q(from('training_plans').insert({
          ...v, client_id: plan.client_id, template_id: plan.template_id || null,
          version: (plan.version || 0) + 1, supersedes: plan.id || null, is_active: true,
          start_date: plan.start_date || new Date().toISOString().slice(0, 10)
        }).select()))[0];
        toast(`Version ${row.version} gespeichert – Kunde wird benachrichtigt`);
        location.hash = back;
      }
    } catch (e) { showError(e); }
  };

  el.append(
    backLink(back),
    pageHead(isNew ? 'Neue Vorlage' : plan.client_id ? `Plan bearbeiten (Version ${plan.version})` : 'Vorlage bearbeiten',
      plan.client_id ? 'Speichern legt eine neue Version an, die alte bleibt im Verlauf.' : null),
    card(null,
      field('Name', name),
      h('div', { class: 'grid3' }, field('Einheiten/Woche', perWeek), field('Wochen', weeks), field('Deload in Woche', deload)),
      field('Notizen zum Plan', notes)),
    sessionsEl,
    h('button', {
      type: 'button', class: 'secondary', onclick: () => {
        const key = KEYS[plan.sessions.length] || String(plan.sessions.length + 1);
        plan.sessions.push({ key, name: 'Einheit ' + key, exercises: [] });
        renderSessions();
      }
    }, '+ Einheit'),
    h('button', { type: 'button', onclick: save }, 'Speichern'),
    !isNew && !plan.client_id ? h('button', {
      type: 'button', class: 'link-btn danger center-block', onclick: async () => {
        if (!await confirmDialog('Vorlage löschen? Zugewiesene Kundenpläne bleiben erhalten.', { ok: 'Löschen', danger: true })) return;
        try { await q(from('training_plans').delete().eq('id', plan.id)); location.hash = '#/c/plaene'; } catch (e) { showError(e); }
      }
    }, 'Vorlage löschen') : null,
    plan.created_at ? h('p', { class: 'muted small center' }, 'Angelegt ' + fmt(plan.created_at)) : null);
  renderSessions();
}
