// Coach: full backup (Supabase Free has no backups) + reminder.
import { h, card, pageHead, toast, showError, download } from '../core/ui.js';
import { q, from } from '../core/db.js';
import { today, diffDays, fmt } from '../core/dates.js';
import { exportClient } from './account.js';

async function coachTables() {
  const t = {};
  for (const name of ['exercises', 'training_plans', 'locations', 'appointments', 'packages', 'coach_settings']) {
    t[name] = await q(from(name).select('*'));
  }
  return t;
}

export async function renderData(el, app) {
  const last = app.rawCoachSettings?.last_backup_at || null;
  const days = last ? diffDays(last.slice(0, 10), today()) : null;
  const status = h('p', { class: days === null || days > 7 ? 'warn-text' : 'ok-text' },
    last ? `Letztes Backup vor ${days} Tag(en) (${fmt(last.slice(0, 10))})` : 'Noch kein Backup gemacht.');

  el.append(pageHead('Daten & Backup', 'Supabase Free macht keine automatischen Backups.'),
    card('Gesamt-Backup', status,
      h('p', { class: 'muted small' }, 'Lädt alle Kunden inkl. Einträge, Pläne, Termine und Abrechnung als eine JSON-Datei. Fotos sind nicht enthalten. Ziel: wöchentlich. Datei sicher aufbewahren (verschlüsselt, nicht in Cloud-Ordnern ohne Passwort) – sie enthält Gesundheitsdaten.'),
      h('button', {
        type: 'button', onclick: async (e) => {
          e.target.disabled = true; e.target.textContent = 'Erstelle Backup …';
          try {
            const clients = await q(from('clients').select('id'));
            const out = { format: 'mxreinert-full-backup', version: 1, exported_at: new Date().toISOString(), coach: await coachTables(), clients: [] };
            for (const c of clients) out.clients.push(await exportClient(c.id));
            download(`backup-mxreinert-${today()}.json`, JSON.stringify(out));
            const settings = { ...(app.rawCoachSettings || {}), last_backup_at: new Date().toISOString() };
            await q(from('coach_settings').upsert({ coach_id: app.profile.id, settings }, { onConflict: 'coach_id' }));
            app.rawCoachSettings = settings;
            status.textContent = 'Backup erstellt ✓'; status.className = 'ok-text';
            toast(`Backup mit ${clients.length} Kunden erstellt`);
          } catch (err) { showError(err); }
          e.target.disabled = false; e.target.textContent = 'Backup herunterladen';
        }
      }, 'Backup herunterladen')),
    card('Einzelner Kunde', h('p', { class: 'muted small' }, 'Export, Import und Löschung pro Kunde findest du beim Kunden unter „Konto & Daten“.')),
    card('Automatische Löschung', h('p', { class: 'muted small' }, 'Verworfene Interessenten werden 45 Tage nach dem Verwerfen automatisch gelöscht (täglicher Server-Job). Nutzungszeiten werden nach 90 Tagen zu Tageswerten zusammengefasst.')));
}
