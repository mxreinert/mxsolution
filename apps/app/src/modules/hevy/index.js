// M9 Hevy-Anbindung (unlock "hevy"). The API key is stored encrypted server-side
// and never comes back to the browser. Imported workouts land in the strength data.
import { h, card, input, field, toast, showError, confirmDialog, modal, clear, srow, scard } from '../../core/ui.js';
import { rpc, api, q, from } from '../../core/db.js';
import { mergeSettings } from '../../core/settings.js';

// same normalisation as the server (netlify/functions/hevy.mjs)
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

/** Hevy exercise names that could not be assigned (taken from the notes of imported workouts) */
async function unmatchedTitles() {
  const rows = await q(from('workouts').select('note').eq('source', 'hevy').like('note', 'Nicht zugeordnete%').order('day', { ascending: false }).limit(300));
  const out = new Map();
  for (const r of rows) {
    for (const t of r.note.replace(/^Nicht zugeordnete Übungen:\s*/, '').split(', ')) if (t.trim()) out.set(norm(t), t.trim());
  }
  return out;
}

/** Choose one of our exercises (simple search list) */
async function chooseExercise(title, all) {
  const search = input({ type: 'search', placeholder: 'Übung suchen …', value: title.replace(/\s*\(.*\)\s*$/, '') });
  const list = h('div', { class: 'picker-list' });
  return modal(`„${title}“ zuordnen`, (close) => {
    const draw = () => {
      const t = search.value.trim().toLowerCase();
      const rows = all.filter((e) => !t || e.name.toLowerCase().includes(t) || (e.base || '').toLowerCase().includes(t) || (e.equipment || '').toLowerCase().includes(t)).slice(0, 60);
      clear(list).append(rows.length ? rows.map((e) => h('button', { type: 'button', class: 'picker-row', onclick: () => close(e) },
        h('strong', null, e.name), h('small', { class: 'muted' }, [e.primary_muscle, e.equipment].filter(Boolean).join(' · ')))) : h('p', { class: 'muted' }, 'Nichts gefunden – anderen Suchbegriff probieren.'));
    };
    search.addEventListener('input', draw);
    draw();
    setTimeout(() => search.focus(), 50);
    return h('div', null, h('div', { class: 'picker-top' }, search), list);
  });
}

/** Card on the coach settings page: assign Hevy exercises to our exercise database */
async function mappingCard(app) {
  const box = h('div');
  const draw = async () => {
    const [unmatched, all] = await Promise.all([unmatchedTitles(), q(from('exercises').select('id, name, base, equipment, primary_muscle').eq('active', true).order('name'))]);
    const byId = new Map(all.map((e) => [e.id, e]));
    const map = { ...(app.rawCoachSettings?.hevy_map || {}) };
    const keys = new Set([...unmatched.keys(), ...Object.keys(map)]);
    const save = async (next) => {
      const settings = { ...(app.rawCoachSettings || {}), hevy_map: next };
      await q(from('coach_settings').upsert({ coach_id: app.profile.id, settings }, { onConflict: 'coach_id' }));
      app.rawCoachSettings = settings; app.settings = mergeSettings(settings);
    };
    const rows = [...keys].sort((a, b) => (map[a] ? 1 : 0) - (map[b] ? 1 : 0)).map((k) => {
      const title = map[k]?.title || unmatched.get(k);
      const ex = map[k] ? byId.get(map[k].exercise_id) : null;
      return srow(title, ex ? `→ ${ex.name}` : 'noch nicht zugeordnet – Sätze werden nicht übernommen',
        h('div', { class: 'row-actions' },
          h('button', {
            type: 'button', class: ex ? 'link-btn' : 'small', onclick: async () => {
              const pick = await chooseExercise(title, all);
              if (!pick) return;
              try { await save({ ...map, [k]: { title, exercise_id: pick.id } }); toast('Zugeordnet'); draw(); } catch (e) { showError(e); }
            }
          }, ex ? 'Ändern' : 'Zuordnen'),
          ex ? h('button', {
            type: 'button', class: 'link-btn danger', onclick: async () => {
              const next = { ...map }; delete next[k];
              try { await save(next); toast('Zuordnung entfernt'); draw(); } catch (e) { showError(e); }
            }
          }, 'Entfernen') : null));
    });
    const open = [...keys].filter((k) => !map[k]).length;
    clear(box).append(
      rows.length ? rows : h('p', { class: 'muted small' }, 'Alle Hevy-Übungen sind zugeordnet. Neue, unbekannte Übungen erscheinen hier nach dem nächsten Abgleich.'),
      h('button', {
        type: 'button', class: 'secondary', onclick: async (ev) => {
          ev.target.disabled = true;
          try {
            const clients = await q(from('clients').select('id, first_name, unlocks').contains('unlocks', ['hevy']));
            let n = 0, skipped = 0;
            for (const c of clients) {
              try { const r = await api('hevy', { action: 'sync', clientId: c.id, full: true }); n += r.imported || 0; if (r.note) skipped += 1; }
              catch (e) { if (!/nicht verbunden/i.test(e.message)) console.warn('hevy resync', c.first_name, e.message); }
            }
            toast(`${n} Training(s) neu abgeglichen${skipped ? ` · ${skipped} Kunde(n) gerade erst abgeglichen, in 1 Minute nochmal` : ''}`);
            draw();
          } catch (e) { showError(e); } finally { ev.target.disabled = false; }
        }
      }, 'Hevy-Trainings neu abgleichen'));
    return open;
  };
  await draw();
  return scard('Hevy-Übungen zuordnen',
    'Hevy-Übungen, die die App nicht automatisch erkennt. Einmal zuordnen – gilt für alle Kunden. Danach „neu abgleichen“, damit die fehlenden Sätze übernommen werden (letzte 50 Trainings).',
    box);
}
import { fmtDateTime } from '../../core/dates.js';

async function status(clientId) {
  try { return (await rpc('hevy_status', { cid: clientId })) || { connected: false }; } catch (e) { return { connected: false }; }
}

async function panel(ctx) {
  const st = await status(ctx.client.id);
  const key = input({ type: 'password', autocomplete: 'off', placeholder: 'Hevy API-Key', maxlength: 200 });
  const sync = async () => {
    try { const r = await api('hevy', { action: 'sync', clientId: ctx.client.id }); toast(`${r.imported} Training(s) importiert`); ctx.refresh(); }
    catch (e) { showError(e); }
  };
  return card('Hevy',
    st.connected
      ? h('div', null,
        h('p', null, 'Verbunden', st.synced_at ? h('span', { class: 'muted' }, ` · zuletzt abgeglichen ${fmtDateTime(st.synced_at)}`) : null),
        h('p', { class: 'muted small' }, 'Trainings werden 1× täglich und beim Klick auf „Jetzt abgleichen“ übernommen. Der eigene Trainings-Logger ist ausgeblendet.'),
        h('div', { class: 'row-actions wrap' },
          h('button', { type: 'button', class: 'secondary', onclick: sync }, 'Jetzt abgleichen'),
          h('button', {
            type: 'button', class: 'link-btn danger', onclick: async () => {
              if (!await confirmDialog('Hevy trennen? Der gespeicherte Key wird gelöscht, importierte Trainings bleiben.', { ok: 'Trennen', danger: true })) return;
              try { await api('hevy', { action: 'disconnect', clientId: ctx.client.id }); toast('Getrennt'); ctx.refresh(); } catch (e) { showError(e); }
            }
          }, 'Trennen')))
      : h('div', null,
        h('p', { class: 'muted small' }, 'Voraussetzung: Hevy Pro. Den API-Key findest du in Hevy unter Einstellungen → Developer. Er wird verschlüsselt gespeichert und ist danach nicht mehr einsehbar.'),
        field('API-Key', key),
        h('button', {
          type: 'button', onclick: async () => {
            if (key.value.trim().length < 10) { toast('Bitte gültigen Key eingeben.', 'bad'); return; }
            try { await api('hevy', { action: 'connect', clientId: ctx.client.id, key: key.value.trim() }); toast('Verbunden'); await sync(); }
            catch (e) { showError(e); }
          }
        }, 'Verbinden')));
}

export default {
  /** card for Coach → Einstellungen */
  coachSettings: mappingCard,
  id: 'hevy',
  name: 'Hevy',
  order: 95,
  icon: 'link',
  color: 'gray',
  description: 'Trainings automatisch aus Hevy übernehmen',
  requires: { unlock: 'hevy' },
  profile: panel,      // client: profile screen
  coach: panel         // coach: client detail
};
