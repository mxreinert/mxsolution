// Coach: exercise database – add video links / technique hints, add own exercises.
import { h, clear, input, select, textarea, field, modal, toast, showError, pageHead, empty, icon } from '../core/ui.js';
import { q, from } from '../core/db.js';

const TRACKING = [['weight_reps', 'Gewicht × Wdh'], ['bodyweight_reps', 'Körpergewicht × Wdh'], ['bodyweight_plus', 'Körpergewicht + Zusatz × Wdh'], ['assisted', 'Assistenz × Wdh'], ['time', 'Zeit'], ['distance', 'Distanz']];

async function edit(ex, all, onDone) {
  const isNew = !ex;
  const id = input({ value: ex?.id || '', maxlength: 40, disabled: !isNew, placeholder: 'z. B. BRU_FLY_KB' });
  const name = input({ value: ex?.name || '', maxlength: 120 });
  const muscles = [...new Set(all.map((e) => e.primary_muscle))].sort();
  const prim = select(muscles.map((m) => [m, m]), ex?.primary_muscle || muscles[0]);
  const sec = input({ value: (ex?.secondary || []).join(', '), placeholder: 'Komma-getrennt' });
  const equip = input({ value: ex?.equipment || '' });
  const track = select(TRACKING, ex?.tracking_type || 'weight_reps');
  const uni = select([['false', 'nein'], ['true', 'ja']], String(!!ex?.unilateral));
  const video = input({ type: 'url', value: ex?.video_url || '', placeholder: 'https://…' });
  const hint = textarea({ value: ex?.hint || '', maxlength: 1000 });
  const alts = [['', '–'], ...all.map((e) => [e.id, e.name])];
  const a1 = select(alts, ex?.alt1 || ''); const a2 = select(alts, ex?.alt2 || '');
  const active = select([['true', 'aktiv'], ['false', 'ausgeblendet']], String(ex?.active ?? true));
  await modal(isNew ? 'Neue Übung' : ex.name, h('div', null,
    field('ID (fest, Großbuchstaben)', id), field('Name', name),
    h('div', { class: 'grid2' }, field('Primärer Muskel', prim), field('Gerät', equip)),
    field('Sekundär', sec), h('div', { class: 'grid2' }, field('Tracking', track), field('Einseitig', uni)),
    field('Videolink', video), field('Technik-Hinweis', hint),
    h('div', { class: 'grid2' }, field('Alternative 1', a1), field('Alternative 2', a2)), field('Status', active),
    h('p', { class: 'hint muted' }, 'Tipp: Größere Änderungen lieber in docs/Uebungsdatenbank.xlsx pflegen und neu einspielen.')), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Speichern', onClick: async () => {
        const row = {
          name: name.value.trim(), primary_muscle: prim.value, secondary: sec.value.split(',').map((x) => x.trim()).filter(Boolean),
          equipment: equip.value.trim() || null, tracking_type: track.value, unilateral: uni.value === 'true',
          video_url: video.value.trim() || null, hint: hint.value.trim() || null, alt1: a1.value || null, alt2: a2.value || null, active: active.value === 'true'
        };
        if (!row.name) { toast('Name fehlt.', 'bad'); return undefined; }
        if (row.video_url && !row.video_url.startsWith('https://')) { toast('Videolink muss mit https:// beginnen.', 'bad'); return undefined; }
        try {
          if (isNew) {
            const newId = id.value.trim().toUpperCase();
            if (!/^[A-Z0-9_]{3,40}$/.test(newId)) { toast('ID: 3–40 Zeichen A–Z, 0–9, _', 'bad'); return undefined; }
            await q(from('exercises').insert({ ...row, id: newId, sort: 10000 }));
          } else await q(from('exercises').update(row).eq('id', ex.id));
          toast('Gespeichert'); onDone?.(); return true;
        } catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

export async function renderExercises(el) {
  const search = input({ type: 'search', placeholder: 'Übung suchen …' });
  const list = h('div');
  let all = [];
  const load = async () => { all = await q(from('exercises').select('*').order('sort')); draw(); };
  const draw = () => {
    clear(list);
    const t = search.value.trim().toLowerCase();
    const rows = all.filter((e) => !t || e.name.toLowerCase().includes(t) || e.primary_muscle.toLowerCase().includes(t));
    if (!rows.length) { list.append(empty('Keine Übungen. Seed-Datei supabase/seed/exercises.sql einspielen.')); return; }
    rows.forEach((e) => list.append(h('button', { type: 'button', class: 'list-row plain' + (e.active ? '' : ' faded'), onclick: () => edit(e, all, load) },
      h('div', null, h('strong', null, e.name), h('div', { class: 'muted small' }, [e.primary_muscle, e.equipment, e.video_url ? '' : null].filter(Boolean).join(' · '))),
      h('span', { class: 'chev' }, icon('chevron', { size: 17 })))));
  };
  search.addEventListener('input', draw);
  el.append(pageHead('Übungen', 'Videolinks und Technik-Hinweise pflegen', h('button', { type: 'button', onclick: () => edit(null, all, load) }, '+ Übung')), search, list);
  await load();
}
