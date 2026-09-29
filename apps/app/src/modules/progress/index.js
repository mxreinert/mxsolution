// M11 Fortschrittsfotos / Umfänge (unlock "photos").
// Photos are compressed on the device (~200 KB) and stored privately: only client + coach.
import { h, card, fmtNum, empty, input, field, modal, toast, showError, confirmDialog, parseNum, compressImage, select, clear, fmtSigned } from '../../core/ui.js';
import { chart } from '../../core/chart.js';
import { q, from, fileUrl, uploadFile, removeFiles } from '../../core/db.js';
import { today, addDays, fmt } from '../../core/dates.js';
import { uuid } from '../../core/ui.js';

const MEASURES = [['waist_cm', 'Taille'], ['chest_cm', 'Brust'], ['hip_cm', 'Hüfte'], ['arm_cm', 'Arm'], ['thigh_cm', 'Oberschenkel']];
const POSES = [['front', 'vorne'], ['side', 'seitlich'], ['back', 'hinten']];

async function addMeasurements(ctx) {
  const day = input({ type: 'date', value: today(), max: today(), min: ctx.role === 'coach' ? undefined : addDays(today(), -3) });
  const ins = Object.fromEntries(MEASURES.map(([k]) => [k, input({ type: 'number', step: '0.1', inputmode: 'decimal', placeholder: 'cm' })]));
  await modal('Umfänge eintragen', h('div', null, field('Datum', day),
    h('div', { class: 'grid2' }, MEASURES.map(([k, l]) => field(l, ins[k]))),
    h('p', { class: 'hint muted' }, 'Immer an derselben Stelle messen, morgens, Maßband nicht einschnüren.')), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Speichern', onClick: async () => {
        const row = { client_id: ctx.client.id, day: day.value };
        MEASURES.forEach(([k]) => { row[k] = parseNum(ins[k].value); });
        if (MEASURES.every(([k]) => row[k] == null)) { toast('Bitte mindestens einen Wert eingeben.', 'bad'); return undefined; }
        try { await q(from('measurements').upsert(row, { onConflict: 'client_id,day' })); toast('Gespeichert'); ctx.refresh(); return true; }
        catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

async function addPhotos(ctx) {
  const day = input({ type: 'date', value: today(), max: today() });
  const files = Object.fromEntries(POSES.map(([k]) => [k, h('input', { type: 'file', accept: 'image/*', capture: 'environment' })]));
  await modal('Fortschrittsfotos', h('div', null, field('Datum', day),
    POSES.map(([k, l]) => field('Foto ' + l, files[k])),
    h('p', { class: 'hint muted' }, 'Gleiches Licht, gleiche Pose, gleicher Abstand. Nur du und Max sehen die Fotos. Du kannst sie jederzeit löschen.')), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Hochladen', onClick: async () => {
        const chosen = POSES.filter(([k]) => files[k].files[0]);
        if (!chosen.length) { toast('Bitte mindestens ein Foto wählen.', 'bad'); return undefined; }
        try {
          for (const [pose] of chosen) {
            const blob = await compressImage(files[pose].files[0], { maxSize: 1000, quality: 0.7 });
            const id = uuid();
            const path = `${ctx.client.id}/photos/${id}.jpg`;
            await uploadFile(path, blob);
            await q(from('progress_photos').insert({ id, client_id: ctx.client.id, day: day.value, pose, path }));
          }
          toast('Fotos gespeichert'); ctx.refresh(); return true;
        } catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

async function photoGallery(ctx, photos) {
  const days = [...new Set(photos.map((p) => p.day))].sort().reverse();
  if (!days.length) return empty('Noch keine Fotos.');
  const a = select(days.map((d) => [d, fmt(d)]), days[days.length - 1]);
  const b = select(days.map((d) => [d, fmt(d)]), days[0]);
  const pose = select(POSES, 'front');
  const out = h('div', { class: 'compare' });
  const img = async (d) => {
    const p = photos.find((x) => x.day === d && x.pose === pose.value);
    if (!p) return h('div', { class: 'photo empty-photo muted' }, 'kein Foto');
    const url = await fileUrl(p.path);
    return h('figure', { class: 'photo' }, h('img', { src: url, alt: `Foto ${fmt(d)}`, loading: 'lazy' }),
      h('figcaption', null, fmt(d), ' ',
        h('button', {
          type: 'button', class: 'link-btn danger', onclick: async () => {
            if (!await confirmDialog('Dieses Foto endgültig löschen?', { ok: 'Löschen', danger: true })) return;
            try { await removeFiles([p.path]); await q(from('progress_photos').delete().eq('id', p.id)); ctx.refresh(); } catch (e) { showError(e); }
          }
        }, 'löschen')));
  };
  const draw = async () => { clear(out).append(await img(a.value), await img(b.value)); };
  [a, b, pose].forEach((x) => x.addEventListener('change', draw));
  await draw();
  return h('div', null, h('div', { class: 'grid3' }, a, b, pose), out);
}

export default {
  id: 'progress',
  name: 'Fotos & Umfänge',
  order: 90,
  icon: 'camera',
  color: 'mint',
  description: 'Umfänge und Fortschrittsfotos im Vergleich',
  requires: { unlock: 'photos' },

  async analysis(ctx) {
    const rows = await q(from('measurements').select('*').eq('client_id', ctx.client.id).order('day'));
    const photos = await q(from('progress_photos').select('*').eq('client_id', ctx.client.id).order('day'));
    const first = rows[0], last = rows[rows.length - 1];

    const m = card('Umfänge',
      rows.length ? h('div', { class: 'kpi-row' }, MEASURES.map(([k, l]) => last?.[k] != null ? h('div', { class: 'kpi' },
        h('span', { class: 'kpi-label muted' }, l),
        h('span', { class: 'kpi-value' }, fmtNum(last[k], 1), h('small', null, ' cm')),
        first && first !== last && first[k] != null ? h('span', { class: 'kpi-sub muted' }, fmtSigned(last[k] - first[k], 1) + ' seit ' + fmt(first.day)) : null) : null)) : empty('Noch keine Umfänge.'),
      rows.length > 1 ? chart({
        from: ctx.from < rows[0].day ? rows[0].day : ctx.from, to: ctx.to, unit: 'cm',
        series: MEASURES.filter(([k]) => rows.some((r) => r[k] != null)).map(([k, l], i) => ({
          label: l, points: rows.filter((r) => r[k] != null).map((r) => ({ d: r.day, v: Number(r[k]) })), cls: ['accent', 'muted', 'warn', 'ok', 'bad'][i], digits: 1, maxGap: 999
        }))
      }) : null,
      h('button', { type: 'button', class: 'secondary', onclick: () => addMeasurements(ctx) }, '+ Umfänge eintragen'),
      h('p', { class: 'hint muted' }, 'Empfehlung: alle 1–4 Wochen messen.'));

    const p = card('Fortschrittsfotos', await photoGallery(ctx, photos),
      ctx.role === 'client' ? h('button', { type: 'button', class: 'secondary', onclick: () => addPhotos(ctx) }, '+ Fotos hinzufügen') : null,
      h('p', { class: 'hint muted' }, 'Empfehlung: 1 Set alle 4 Wochen. Fotos werden stark verkleinert gespeichert.'));

    const frag = document.createDocumentFragment();
    frag.append(m, p);
    return frag;
  }
};
