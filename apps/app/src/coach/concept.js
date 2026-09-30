// Konzept: status, goal, modules, targets, unlocks, check-in day, consents.
import { h, input, textarea, select, field, toggle, toast, showError, card, parseNum, confirmDialog, tile } from '../core/ui.js';
import { q, from } from '../core/db.js';
import { GOALS, GOAL_OPTIONS, STATUS } from '../core/goals.js';
import { SELECTABLE, UNLOCKS } from '../core/modules.js';
import { WEEKDAYS, isMinor, today } from '../core/dates.js';

const TARGETS = [
  ['kcal', 'Kalorien (Trainingstag)', 'kcal'], ['kcal_rest', 'Kalorien (Ruhetag, optional)', 'kcal'],
  ['protein_g', 'Protein', 'g'], ['carbs_g', 'Kohlenhydrate', 'g'], ['fat_g', 'Fett', 'g'],
  ['steps', 'Schritte', ''], ['sleep_h', 'Schlaf', 'h'],
  ['weekly_change_kg', 'Gewichtsveränderung pro Woche (z. B. 0.25 oder -0.5)', 'kg'],
  ['cardio_min_week', 'Cardio pro Woche', 'min']
];

export function renderConcept(el, client, onSaved) {
  const status = select(Object.entries(STATUS).map(([k, s]) => [k, s.label]), client.status);
  const statusUntil = input({ type: 'date', value: client.status_until || '' });
  const goal = select([['', '– offen –'], ...GOAL_OPTIONS], client.goal || '');
  const goalStart = input({ type: 'date', value: client.goal_start || '' });
  const goalEnd = input({ type: 'date', value: client.goal_end || '' });
  const milestones = textarea({ value: client.milestones || '', maxlength: 4000, placeholder: 'Etappenziele, z. B. „Woche 4: 67 kg, Bankdrücken 70 kg“' });
  const review = input({ type: 'date', value: client.plan_review_at || '' });
  const checkinDay = select(WEEKDAYS.map((d, i) => [i, d]), client.checkin_weekday);
  const inactivity = input({ type: 'number', min: 1, max: 60, value: client.inactivity_days });

  const modules = new Set(client.modules || []);
  const modBox = h('div', { class: 'check-list' });
  const drawMods = () => modBox.replaceChildren(...SELECTABLE.map(([id, name]) => {
    const cb = h('input', { type: 'checkbox', checked: modules.has(id), onchange: () => { cb.checked ? modules.add(id) : modules.delete(id); } });
    const opt = GOALS[goal.value]?.optional?.includes(id);
    return h('label', { class: 'check' }, cb, h('span', null, name, opt ? h('small', { class: 'muted' }, ' (optional fürs Ziel)') : null,
      id === 'cycle' ? h('small', { class: 'muted' }, ' – nur mit Einwilligung') : null));
  }));
  drawMods();
  const presetBtn = h('button', {
    type: 'button', class: 'link-btn', onclick: async () => {
      if (!goal.value) { toast('Erst ein Ziel wählen.', 'bad'); return; }
      if (modules.size && !await confirmDialog('Module auf die Voreinstellung des Ziels zurücksetzen?')) return;
      modules.clear(); GOALS[goal.value].modules.forEach((m) => modules.add(m)); drawMods();
    }
  }, 'Voreinstellung des Ziels übernehmen');

  const unlocks = new Set(client.unlocks || []);
  const unlockBox = h('div', { class: 'check-list' }, UNLOCKS.map(([id, name]) => {
    const cb = h('input', { type: 'checkbox', checked: unlocks.has(id), onchange: () => { cb.checked ? unlocks.add(id) : unlocks.delete(id); } });
    return h('label', { class: 'check' }, cb, h('span', null, name));
  }));

  const t = client.targets || {};
  const tIn = Object.fromEntries(TARGETS.map(([k]) => [k, input({ type: 'number', step: k === 'sleep_h' || k === 'weekly_change_kg' ? '0.05' : '1', value: t[k] ?? '', inputmode: 'decimal' })]));

  // consents
  const ec = client.extra_consents || {};
  const anamC = input({ type: 'date', value: client.anamnesis_consent_at || '' });
  const consent = input({ type: 'date', value: client.consent_at || '' });
  const parentC = input({ type: 'date', value: client.parent_consent_at || '' });
  const parentName = input({ value: client.parent_name || '', maxlength: 120 });
  const birth = input({ type: 'date', value: client.birthdate || '' });
  const extra = Object.fromEntries([['ai', 'KI-Analyse (Übertragung USA)'], ['cycle', 'Zyklus-Modul'], ['photos', 'Fortschrittsfotos']].map(([k, l]) => [k, { l, el: input({ type: 'date', value: ec[k] || '' }) }]));
  const minor = isMinor(client.birthdate);

  el.append(
    card('Status', h('div', { class: 'grid2' }, field('Status', status), field('bis (optional)', statusUntil)),
      client.return_requested_at ? h('p', { class: 'hint' }, 'Kunde meldet „wieder fit“. Wiedereinstieg: Status auf Aktiv/Reduziert setzen, ggf. Plan mit ~60 % Volumen.') : null),
    card('Ziel', field('Hauptziel', goal), h('div', { class: 'grid2' }, field('Start', goalStart), field('Ende', goalEnd)),
      field('Etappenziele', milestones), field('Konzept überarbeiten am', review, 'Erinnerung für dich: Ab 7 Tagen vorher steht beim Kunden unter „Übersicht“ ein Hinweis. Üblich: alle 4–8 Wochen.')),
    h('a', { class: 'fcard', href: `#/c/kunde/${client.id}?tab=module` },
      tile('grid', 'accent', 40),
      h('div', { class: 'fc-body' }, h('div', { class: 'fc-title' }, 'Module, Zielwerte & Premium'), h('div', { class: 'fc-sub' }, 'Jetzt im Tab „Module“ – mit Einstellungen pro Modul'))),
    card('Check-in & Hinweise', h('div', { class: 'grid2' }, field('Check-in-Tag', checkinDay), field('Hinweis an dich nach X Tagen ohne App-Öffnen', inactivity))),
    card('Einwilligungen (Papier, Datum hier dokumentieren)',
      field('Geburtsdatum', birth),
      field('Einwilligung Anamnese (vor Vertrag)', anamC),
      field('Datenschutz-Einwilligung Kunde', consent),
      minor || !client.birthdate ? h('div', null, field('Einwilligung Eltern' + (minor ? ' (Pflicht, minderjährig)' : ''), parentC), field('Name Elternteil', parentName)) : null,
      Object.values(extra).map((x) => field('Zusatz: ' + x.l, x.el))),
    h('button', {
      type: 'button', class: 'sticky-save', onclick: async () => {
        const extra_consents = Object.fromEntries(Object.entries(extra).filter(([, x]) => x.el.value).map(([k, x]) => [k, x.el.value]));
        const patch = {
          status: status.value, status_until: statusUntil.value || null,
          goal: goal.value || null, goal_start: goalStart.value || null, goal_end: goalEnd.value || null,
          milestones: milestones.value.trim() || null, plan_review_at: review.value || null,
          modules: client.goal !== goal.value && goal.value && !(client.modules || []).length ? [...GOALS[goal.value].modules] : client.modules,
          checkin_weekday: Number(checkinDay.value), inactivity_days: parseNum(inactivity.value) || 3,
          birthdate: birth.value || null, anamnesis_consent_at: anamC.value || null, consent_at: consent.value || null,
          parent_consent_at: parentC.value || null, parent_name: parentName.value.trim() || null, extra_consents
        };
        if (patch.status !== client.status && !['paused_sick', 'paused_other'].includes(patch.status)) patch.return_requested_at = null;
        if (patch.goal && !patch.goal_start) patch.goal_start = today();
        try { await q(from('clients').update(patch).eq('id', client.id)); toast('Konzept gespeichert'); onSaved?.(); }
        catch (e) { showError(e); }
      }
    }, 'Konzept speichern'));
}
