// Coach: login creation, password reset, deactivate, export/import, delete.
import { h, card, input, field, modal, toast, showError, confirmDialog, download, toCsv, badge } from '../core/ui.js';
import { q, from, api } from '../core/db.js';
import { isMinor, today, fmt, fmtDateTime } from '../core/dates.js';
import { missingRequired } from './anamnesis.js';

export const EXPORT_FORMAT = 'mxreinert-client-export';
export const EXPORT_VERSION = 1;

// tables with client_id, in import order (parents first)
const TABLES = [
  'client_settings', 'daily_entries', 'checkins', 'training_plans', 'workouts', 'workout_sets', 'tested_maxes',
  'cardio_sessions', 'supplements', 'supplement_logs', 'cycle_entries', 'measurements', 'progress_photos',
  'client_status_log', 'client_notes', 'pt_ledger', 'appointment_clients', 'client_packages', 'charges', 'payments',
  'app_opens', 'app_opens_daily', 'ai_analyses'
];
// identity columns are regenerated on import
const DROP_ID = new Set(['client_status_log', 'client_notes', 'pt_ledger', 'app_opens']);
// not imported (depend on coach-wide data or are regenerated)
const SKIP_IMPORT = new Set(['appointment_clients', 'client_packages', 'charges', 'payments', 'app_opens', 'app_opens_daily', 'progress_photos', 'ai_analyses']);

async function fetchAll(table, clientId) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = await q(from(table).select('*').eq('client_id', clientId).range(offset, offset + 999));
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function exportClient(clientId) {
  const client = (await q(from('clients').select('*').eq('id', clientId)))[0];
  const tables = {};
  for (const t of TABLES) {
    try { tables[t] = await fetchAll(t, clientId); } catch (e) { tables[t] = { error: e.message }; }
  }
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exported_at: new Date().toISOString(), client, tables };
}

export async function downloadExport(client) {
  const data = await exportClient(client.id);
  const name = `${client.first_name}-${client.last_name || ''}`.replace(/[^a-z0-9äöüß-]/gi, '').toLowerCase();
  download(`export-${name}-${today()}.json`, JSON.stringify(data, null, 1));
  if (data.tables.daily_entries?.length) download(`tageswerte-${name}-${today()}.csv`, toCsv(data.tables.daily_entries), 'text/csv;charset=utf-8');
  toast('Export erstellt (JSON + CSV). Fotos sind nicht enthalten.');
}

/** Re-import a previous export into an existing client record (re-entry after a break). */
export async function importIntoClient(client, file) {
  const data = JSON.parse(await file.text());
  if (data.format !== EXPORT_FORMAT) throw new Error('Keine gültige Export-Datei.');
  if (data.version > EXPORT_VERSION) throw new Error('Export ist neuer als diese App-Version.');
  let count = 0;
  for (const t of TABLES) {
    if (SKIP_IMPORT.has(t)) continue;
    const rows = Array.isArray(data.tables?.[t]) ? data.tables[t] : [];
    if (!rows.length) continue;
    const prepared = rows.map((r) => {
      const x = { ...r, client_id: client.id };
      if (DROP_ID.has(t)) delete x.id;
      if (t === 'training_plans') x.is_active = false;
      if (t === 'pt_ledger') x.appointment_id = null;
      if (t === 'workouts') x.appointment_id = null;
      return x;
    });
    for (let i = 0; i < prepared.length; i += 500) {
      const chunk = prepared.slice(i, i + 500);
      if (DROP_ID.has(t)) await q(from(t).insert(chunk));
      else await q(from(t).upsert(chunk));
    }
    count += prepared.length;
  }
  // concept data (only fields that are empty today)
  const c = data.client || {};
  const patch = {};
  for (const k of ['anamnesis', 'emergency', 'targets', 'milestones', 'goal']) {
    const cur = client[k];
    if ((cur == null || (typeof cur === 'object' && !Object.keys(cur).length)) && c[k] != null) patch[k] = c[k];
  }
  if (Object.keys(patch).length) await q(from('clients').update(patch).eq('id', client.id));
  return count;
}

function startPassword() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const s = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

function showPasswordOnce(username, pw) {
  return modal('Zugangsdaten – nur jetzt sichtbar', h('div', null,
    h('p', null, 'Gib dem Kunden diese Daten persönlich. Beim ersten Login muss er ein eigenes Passwort setzen.'),
    h('table', { class: 'kv' }, h('tbody', null,
      h('tr', null, h('th', null, 'App'), h('td', null, 'app.mxreinert.de')),
      h('tr', null, h('th', null, 'Benutzername'), h('td', null, h('code', null, username))),
      h('tr', null, h('th', null, 'Startpasswort'), h('td', null, h('code', null, pw))))),
    h('button', { type: 'button', class: 'secondary', onclick: () => navigator.clipboard?.writeText(`app.mxreinert.de\nBenutzer: ${username}\nStartpasswort: ${pw}`).then(() => toast('Kopiert')) }, 'Kopieren')),
  [{ label: 'Fertig', value: true }]);
}

/** Checks before a lead becomes a customer. Returns list of blocking problems. */
export function takeoverProblems(client) {
  const p = [];
  if (!client.birthdate) p.push('Geburtsdatum fehlt');
  if (!client.consent_at) p.push('Datenschutz-Einwilligung fehlt');
  if (isMinor(client.birthdate) && !client.parent_consent_at) p.push('Einwilligung der Eltern fehlt (minderjährig)');
  if (!client.goal) p.push('Ziel fehlt');
  return p;
}

export async function takeOver(client, onDone) {
  const problems = takeoverProblems(client);
  if (problems.length) {
    await modal('Noch nicht möglich', h('ul', null, problems.map((x) => h('li', null, x))), [{ label: 'Ok', value: true }]);
    return;
  }
  const miss = missingRequired(client);
  const suggestion = (client.first_name + (client.last_name ? '.' + client.last_name[0] : '')).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9._-]/g, '');
  const username = input({ value: suggestion, maxlength: 32, autocapitalize: 'none', autocomplete: 'off' });
  const ok = await modal('Als Kunde übernehmen', h('div', null,
    miss.length ? h('p', { class: 'warn-text' }, `Hinweis: ${miss.length} Pflichtfeld(er) der Anamnese sind noch offen.`) : null,
    field('Benutzername (3–32 Zeichen: a–z, 0–9, . _ -)', username),
    h('p', { class: 'muted small' }, 'Es wird ein Startpasswort erzeugt und einmal angezeigt. Anamnese und Konzept wandern mit.')), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    { label: 'Konto anlegen', value: true }
  ]);
  if (!ok) return;
  const u = username.value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(u)) { toast('Benutzername ungültig.', 'bad'); return; }
  const pw = startPassword();
  try {
    await api('account', { action: 'create', clientId: client.id, username: u, password: pw });
    await showPasswordOnce(u, pw);
    onDone?.();
  } catch (e) { showError(e); }
}

export async function renderAccount(el, client, onDone) {
  const hasLogin = !!client.user_id;
  let profile = null;
  if (hasLogin) profile = (await q(from('profiles').select('username, must_change_password, created_at').eq('id', client.user_id)))[0];
  const lastOpen = hasLogin ? (await q(from('app_opens').select('opened_at').eq('client_id', client.id).order('opened_at', { ascending: false }).limit(1)))[0] : null;
  const fileIn = h('input', { type: 'file', accept: 'application/json', hidden: true });
  fileIn.addEventListener('change', async () => {
    if (!fileIn.files[0]) return;
    if (!await confirmDialog('Export in diesen Kunden importieren? Vorhandene Einträge mit gleicher ID werden überschrieben.')) return;
    try { const n = await importIntoClient(client, fileIn.files[0]); toast(`${n} Einträge importiert`); onDone?.(); } catch (e) { showError(e); }
  });

  el.append(card('Zugang',
    hasLogin
      ? h('div', null,
        h('p', null, 'Benutzername: ', h('code', null, profile?.username || '?'), ' ', profile?.must_change_password ? badge('Startpasswort noch aktiv', 'warn') : badge('eigenes Passwort gesetzt', 'ok')),
        h('p', { class: 'muted small' }, `Konto seit ${fmt(profile?.created_at)}${lastOpen ? ` · zuletzt geöffnet ${fmtDateTime(lastOpen.opened_at)}` : ' · noch nie geöffnet'}`),
        h('div', { class: 'row-actions wrap' },
          h('button', {
            type: 'button', class: 'secondary', onclick: async () => {
              if (!await confirmDialog('Neues Startpasswort erzeugen? Das alte Passwort funktioniert dann nicht mehr.')) return;
              const pw = startPassword();
              try { await api('account', { action: 'reset_password', clientId: client.id, password: pw }); await showPasswordOnce(profile.username, pw); onDone?.(); } catch (e) { showError(e); }
            }
          }, 'Passwort zurücksetzen'),
          h('button', {
            type: 'button', class: 'secondary', onclick: async () => {
              const deactivate = client.status !== 'ended';
              if (!await confirmDialog(deactivate ? 'Coaching beenden und Login sperren? Daten bleiben bis zur Löschung erhalten.' : 'Login wieder freigeben und Kunde aktivieren?')) return;
              try { await api('account', { action: deactivate ? 'deactivate' : 'reactivate', clientId: client.id }); toast(deactivate ? 'Beendet, Login gesperrt' : 'Wieder aktiv'); onDone?.(); } catch (e) { showError(e); }
            }
          }, client.status === 'ended' ? 'Login wieder freigeben' : 'Beenden & Login sperren')))
      : h('div', null,
        h('p', { class: 'muted' }, 'Noch kein Login. Aus dem Interessenten wird mit einem Klick ein Kunde.'),
        takeoverProblems(client).length ? h('ul', { class: 'warn-text small' }, takeoverProblems(client).map((x) => h('li', null, x))) : null,
        h('button', { type: 'button', onclick: () => takeOver(client, onDone) }, 'Als Kunde übernehmen'),
        client.status !== 'discarded'
          ? h('button', {
            type: 'button', class: 'link-btn danger', onclick: async () => {
              if (!await confirmDialog('Interessent verwerfen? Die Daten werden nach 45 Tagen automatisch gelöscht.')) return;
              try { await q(from('clients').update({ status: 'discarded' }).eq('id', client.id)); onDone?.(); } catch (e) { showError(e); }
            }
          }, 'Verwerfen')
          : h('button', { type: 'button', class: 'link-btn', onclick: async () => { try { await q(from('clients').update({ status: 'lead' }).eq('id', client.id)); onDone?.(); } catch (e) { showError(e); } } }, 'Zurückholen'))),
  card('Daten',
    h('p', { class: 'muted small' }, 'Export für Auskunft/Übergabe: JSON (wieder einlesbar, versioniert) + CSV der Tageswerte.'),
    h('div', { class: 'row-actions wrap' },
      h('button', { type: 'button', class: 'secondary', onclick: () => downloadExport(client).catch(showError) }, 'Export herunterladen'),
      h('button', { type: 'button', class: 'secondary', onclick: () => fileIn.click() }, 'Früheren Export importieren'), fileIn)),
  card('Löschen',
    h('p', { class: 'muted small' }, 'Löscht Login, alle Einträge, Fotos und das Profilbild endgültig. Vorher Export anbieten.'),
    h('button', {
      type: 'button', class: 'danger', onclick: async () => {
        if (!await confirmDialog(`${client.first_name} und ALLE Daten endgültig löschen? Das kann nicht rückgängig gemacht werden.`, { ok: 'Endgültig löschen', danger: true })) return;
        if (!await confirmDialog('Wirklich? Letzte Bestätigung.', { ok: 'Ja, löschen', danger: true })) return;
        try {
          if (client.user_id) await api('account', { action: 'delete', clientId: client.id });
          else await q(from('clients').delete().eq('id', client.id));
          toast('Gelöscht'); location.hash = '#/c/kunden';
        } catch (e) { showError(e); }
      }
    }, 'Kunde endgültig löschen')));
}
