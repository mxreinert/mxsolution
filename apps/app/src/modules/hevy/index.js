// M9 Hevy-Anbindung (unlock "hevy"). The API key is stored encrypted server-side
// and never comes back to the browser. Imported workouts land in the strength data.
import { h, card, input, field, toast, showError, confirmDialog } from '../../core/ui.js';
import { rpc, api } from '../../core/db.js';
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
        h('p', null, '✅ Verbunden', st.synced_at ? h('span', { class: 'muted' }, ` · zuletzt abgeglichen ${fmtDateTime(st.synced_at)}`) : null),
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
  id: 'hevy',
  name: 'Hevy',
  order: 95,
  requires: { unlock: 'hevy' },
  profile: panel,      // client: profile screen
  coach: panel         // coach: client detail
};
