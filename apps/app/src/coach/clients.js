// Coach: list of clients and leads, create lead.
import { h, clear, input, field, modal, toast, showError, pageHead, tabs, empty, badge } from '../core/ui.js';
import { q, from } from '../core/db.js';
import { STATUS } from '../core/goals.js';
import { isMinor } from '../core/dates.js';
import { loadOverview, ampelRow } from './home.js';

export async function createLead() {
  const first = input({ maxlength: 80, autocomplete: 'off' });
  const last = input({ maxlength: 80, autocomplete: 'off' });
  const phone = input({ type: 'tel', maxlength: 40 });
  const birth = input({ type: 'date' });
  return modal('Neuer Interessent', h('div', null,
    h('div', { class: 'grid2' }, field('Vorname', first), field('Nachname', last)),
    field('Telefon', phone), field('Geburtsdatum', birth, 'Wichtig für die Eltern-Einwilligung bei Minderjährigen.'),
    h('p', { class: 'hint muted' }, 'Anamnese-Daten erst speichern, wenn die Einwilligung dazu vorliegt. Verworfene Interessenten werden nach 45 Tagen gelöscht.')), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Anlegen', onClick: async () => {
        if (!first.value.trim()) { toast('Vorname fehlt.', 'bad'); return undefined; }
        try {
          const row = (await q(from('clients').insert({
            first_name: first.value.trim(), last_name: last.value.trim() || null, phone: phone.value.trim() || null, birthdate: birth.value || null
          }).select()))[0];
          toast('Interessent angelegt');
          location.hash = '#/c/kunde/' + row.id + '?tab=anamnese';
          return true;
        } catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

export async function renderClients(el, app, query) {
  let filter = query.f || 'client';
  const search = input({ type: 'search', placeholder: 'Suchen …', autocomplete: 'off' });
  const list = h('div');
  const { clients, withAmpel } = await loadOverview(app);
  const ampelOf = new Map(withAmpel.map((x) => [x.c.id, x.a]));

  const draw = () => {
    clear(list);
    const term = search.value.trim().toLowerCase();
    const rows = clients.filter((c) => (STATUS[c.status]?.group === filter || (filter === 'lead' && c.status === 'discarded')) &&
      (!term || `${c.first_name} ${c.last_name || ''}`.toLowerCase().includes(term)));
    if (!rows.length) { list.append(empty(filter === 'lead' ? 'Keine Interessenten.' : 'Keine Einträge.')); return; }
    for (const c of rows) {
      const a = ampelOf.get(c.id) || { level: 'none', reasons: [] };
      const row = ampelRow(c, a);
      if (isMinor(c.birthdate)) row.querySelector('strong').append(' ', badge(c.parent_consent_at ? 'minderjährig ✓' : 'minderjährig', c.parent_consent_at ? '' : 'warn'));
      list.append(row);
    }
  };
  search.addEventListener('input', draw);
  const tabBar = h('div');
  const renderTabs = () => clear(tabBar).append(tabs([['client', 'Kunden'], ['lead', 'Interessenten'], ['ended', 'Beendet']], filter, (v) => { filter = v; renderTabs(); draw(); }));
  renderTabs();
  el.append(pageHead('Kunden', null, h('button', { type: 'button', onclick: createLead }, '+ Interessent')), tabBar, search, list);
  draw();
}
