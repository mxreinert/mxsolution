// M12 Personal Training (unlock "pt"): appointments, locations, PT balance, reminders.
import { h, card, fmtNum, empty, input, select, field, modal, toast, showError, confirmDialog, textarea, parseNum, badge, clear, pageHead, download, toggle, segmented, tile, icon } from '../../core/ui.js';
import { q, from, rpc, api } from '../../core/db.js';
import { today, addDays, fmtDateTime, fmt, fmtTime, weekStart, WD_SHORT, iso, relDay } from '../../core/dates.js';

const KINDS = [['strength', 'Kraft'], ['cardio', 'Cardio'], ['technique', 'Technik'], ['test', 'Test'], ['call', 'Online-Call (Google Meet)'], ['other', 'Sonstiges']];
const ATT = {
  open: 'offen', confirmed: 'bestätigt', cancelled_client: 'abgesagt (Kunde)', cancelled_coach: 'abgesagt (Max)',
  cancelled_sick: 'abgesagt – Krankheit', no_show: 'nicht erschienen', attended: 'durchgeführt'
};
const kindLabel = (k) => (k === 'call' ? 'Online-Call' : KINDS.find(([v]) => v === k)?.[1] || k);
const safeUrl = (u) => (/^https:\/\/[^\s"'<>]+$/.test(u || '') ? u : null);

/** "Meet beitreten" button (link comes from Google Calendar or was pasted by Max) */
export function meetButton(a, small = false) {
  const url = safeUrl(a.meet_url);
  if (!url) return null;
  return h('a', { class: 'button' + (small ? ' small' : ''), href: url, target: '_blank', rel: 'noopener noreferrer' }, icon('phone', { size: 16 }), 'Meet beitreten');
}

// ---------- helpers ----------
export function mapLinks(address) {
  if (!address) return null;
  const qs = encodeURIComponent(address);
  const ios = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
  const primary = ios ? `https://maps.apple.com/?q=${qs}` : `https://www.google.com/maps/search/?api=1&query=${qs}`;
  const other = ios ? `https://www.google.com/maps/search/?api=1&query=${qs}` : `https://maps.apple.com/?q=${qs}`;
  return h('span', { class: 'row-actions' },
    h('a', { class: 'button small', href: primary, target: '_blank', rel: 'noopener noreferrer' }, icon('location', { size: 16 }), 'Karte'),
    h('a', { class: 'link-btn small', href: other, target: '_blank', rel: 'noopener noreferrer' }, 'andere Karten-App'));
}

function icsDate(d) { return new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function icsEscape(s) { return String(s || '').replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n'); }

export function downloadIcs(appt, loc) {
  const end = new Date(new Date(appt.starts_at).getTime() + appt.duration_min * 60000);
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//mxreinert//Coaching//DE', 'BEGIN:VEVENT',
    `UID:${appt.id}@mxreinert.de`, `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(appt.starts_at)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(appt.kind === 'call' ? 'Online-Call mit Max' : 'Personal Training mit Max – ' + kindLabel(appt.kind))}`,
    safeUrl(appt.meet_url) ? `URL:${appt.meet_url}` : null,
    loc ? `LOCATION:${icsEscape([loc.name, loc.address].filter(Boolean).join(', '))}` : null,
    appt.note ? `DESCRIPTION:${icsEscape(appt.note)}` : null,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Personal Training', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
  download('pt-termin.ics', ics, 'text/calendar');
}

async function loadLocations(coachId) {
  const qb = from('locations').select('*').eq('active', true).order('name');
  return q(coachId ? qb.eq('coach_id', coachId) : qb);
}

async function clientAppointments(clientId, fromTs) {
  const rows = await q(from('appointment_clients').select('status, late_cancel, appointments(*)').eq('client_id', clientId));
  return rows.filter((r) => r.appointments && (!fromTs || r.appointments.starts_at >= fromTs))
    .map((r) => ({ ...r.appointments, my_status: r.status, late_cancel: r.late_cancel }))
    .sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
}

async function balance(clientId) {
  const rows = await q(from('pt_balance').select('balance').eq('client_id', clientId));
  return rows[0]?.balance ?? 0;
}

function apptCard(ctx, a, locs) {
  const loc = locs.find((l) => l.id === a.location_id);
  const canRespond = ctx.role === 'client' && a.status === 'planned' && new Date(a.starts_at) > new Date() && ['open', 'confirmed'].includes(a.my_status);
  return h('div', { class: 'card' },
    h('div', { class: 'row-main' }, a.kind === 'call' ? tile('phone', 'teal', 40) : tile('people', 'indigo', 40),
      h('div', { style: { flex: '1' } }, h('div', { class: 'fc-title' }, a.kind === 'call' ? 'Online-Call' : 'Personal Training'), h('div', { class: 'muted' }, fmtDateTime(a.starts_at))),
      badge(ATT[a.my_status] || a.status, a.my_status === 'confirmed' ? 'ok' : '')),
    h('p', { class: 'muted', style: { marginTop: '10px' } }, [kindLabel(a.kind), `${a.duration_min} min`, loc?.name].filter(Boolean).join(' · ')),
    loc?.address ? h('p', { class: 'small' }, loc.address) : null,
    loc?.hint ? h('p', { class: 'hint' }, loc.hint) : null,
    a.note ? h('p', { class: 'hint' }, a.note) : null,
    a.coach_note_visible && a.coach_note ? h('p', { class: 'hint' }, 'Notiz von Max: ', a.coach_note) : null,
    a.kind === 'call' && !safeUrl(a.meet_url) ? h('p', { class: 'muted small' }, 'Der Meet-Link erscheint hier, sobald Max ihn angelegt hat.') : null,
    h('div', { class: 'row-actions wrap' },
      meetButton(a),
      mapLinks(loc?.address),
      h('button', { type: 'button', class: 'link-btn', onclick: () => downloadIcs(a, loc) }, icon('calendar', { size: 18 }), 'Kalender'),
      canRespond && a.my_status !== 'confirmed' ? h('button', {
        type: 'button', class: 'small', onclick: async () => {
          try { await rpc('client_respond_appointment', { aid: a.id, p_action: 'confirm' }); toast('Bestätigt'); ctx.refresh(); } catch (e) { showError(e); }
        }
      }, 'Bestätigen') : null,
      canRespond ? h('button', {
        type: 'button', class: 'link-btn danger', onclick: async () => {
          const hours = ctx.settings.cancel_hours || 24;
          const late = new Date(a.starts_at) - new Date() < hours * 3600e3;
          if (!await confirmDialog(late ? `Absage weniger als ${hours} h vorher gilt als kurzfristig (siehe Vertrag). Trotzdem absagen?` : 'Termin absagen?', { ok: 'Absagen', danger: true })) return;
          try { await rpc('client_respond_appointment', { aid: a.id, p_action: 'cancel' }); toast('Abgesagt – Max wurde informiert'); ctx.refresh(); } catch (e) { showError(e); }
        }
      }, 'Absagen') : null));
}

// ---------- coach: appointment editor ----------
async function editAppointment(appt, { presetClient, presetKind, presetNote } = {}) {
  const clients = await q(from('clients').select('id, first_name, last_name, unlocks, status').not('user_id', 'is', null).order('first_name'));
  const ptClients = clients.filter((c) => !['ended', 'discarded'].includes(c.status));
  const locs = await loadLocations();
  const existing = appt ? await q(from('appointment_clients').select('client_id, status').eq('appointment_id', appt.id)) : [];
  const chosen = new Set(existing.map((e) => e.client_id));
  if (presetClient) chosen.add(presetClient);

  const start = appt ? new Date(appt.starts_at) : new Date(Date.now() + 864e5);
  const date = input({ type: 'date', value: iso(start) });
  const time = input({ type: 'time', value: appt ? fmtTime(appt.starts_at) : '18:00', step: 300 });
  const dur = input({ type: 'number', value: appt?.duration_min || 60, min: 5, max: 600, step: 5 });
  const loc = select([['', '– kein Ort –'], ...locs.map((l) => [l.id, l.name])], appt?.location_id || '');
  const kind = select(KINDS, appt?.kind || presetKind || 'strength');
  const note = input({ value: appt?.note || presetNote || '', maxlength: 1000, placeholder: 'z. B. Laufschuhe mitbringen' });
  const meet = input({ type: 'url', value: appt?.meet_url || '', maxlength: 300, placeholder: 'https://meet.google.com/…', inputmode: 'url' });
  const meetField = field('Meet-Link', meet, 'Leer lassen: Ist Google Kalender verbunden, wird automatisch ein Google Meet erstellt. Der Kunde sieht den Link in der App.');
  const syncKind = () => { meetField.hidden = kind.value !== 'call'; };
  kind.addEventListener('change', syncKind);
  syncKind();
  const repeat = input({ type: 'number', value: 1, min: 1, max: 26, disabled: !!appt });
  const clientBox = h('div', { class: 'check-list' }, ptClients.map((c) => {
    const cb = h('input', { type: 'checkbox', checked: chosen.has(c.id), onchange: () => { cb.checked ? chosen.add(c.id) : chosen.delete(c.id); } });
    return h('label', { class: 'check' }, cb, h('span', null, `${c.first_name} ${c.last_name || ''}`, !c.unlocks?.includes('pt') ? h('small', { class: 'muted' }, ' (PT nicht freigeschaltet)') : null));
  }));
  const warn = h('p', { class: 'warn-text' });

  const checkConflict = async () => {
    warn.textContent = '';
    const s = new Date(`${date.value}T${time.value}`);
    const e = new Date(s.getTime() + (parseNum(dur.value) || 60) * 60000);
    const others = await q(from('appointments').select('id, starts_at, duration_min').neq('status', 'cancelled')
      .gte('starts_at', new Date(s.getTime() - 12 * 3600e3).toISOString()).lte('starts_at', e.toISOString()));
    const clash = others.filter((o) => o.id !== appt?.id && new Date(o.starts_at) < e && new Date(new Date(o.starts_at).getTime() + o.duration_min * 60000) > s);
    if (clash.length) warn.textContent = `Überschneidung mit ${clash.length} anderem Termin (${clash.map((c) => fmtTime(c.starts_at)).join(', ')})`;
  };
  [date, time, dur].forEach((x) => x.addEventListener('change', checkConflict));

  return modal(appt ? 'Termin bearbeiten' : 'Neuer PT-Termin', h('div', null,
    h('div', { class: 'grid3' }, field('Datum', date), field('Uhrzeit', time), field('Dauer (min)', dur)),
    warn,
    h('div', { class: 'grid2' }, field('Ort', loc), field('Art', kind)),
    meetField,
    field('Hinweis für Kunden', note),
    !appt ? field('Wöchentlich wiederholen (Anzahl Termine)', repeat) : null,
    field('Kunde(n)', clientBox)), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Speichern', onClick: async () => {
        if (!chosen.size) { toast('Bitte mindestens einen Kunden wählen.', 'bad'); return undefined; }
        const startsAt = new Date(`${date.value}T${time.value}`);
        if (Number.isNaN(startsAt.getTime())) { toast('Datum/Uhrzeit prüfen.', 'bad'); return undefined; }
        const meetUrl = kind.value === 'call' ? meet.value.trim() || null : null;
        if (meetUrl && !safeUrl(meetUrl)) { toast('Der Meet-Link muss mit https:// beginnen.', 'bad'); return undefined; }
        try {
          const base = { duration_min: parseNum(dur.value) || 60, location_id: loc.value || null, kind: kind.value, note: note.value.trim() || null, meet_url: meetUrl };
          const saved = [];
          if (appt) {
            const moved = new Date(appt.starts_at).getTime() !== startsAt.getTime();
            await q(from('appointments').update({ ...base, starts_at: startsAt.toISOString() }).eq('id', appt.id));
            const before = new Set(existing.map((e) => e.client_id));
            const add = [...chosen].filter((c) => !before.has(c)).map((client_id) => ({ appointment_id: appt.id, client_id }));
            const remove = [...before].filter((c) => !chosen.has(c));
            if (add.length) await q(from('appointment_clients').insert(add));
            if (remove.length) await q(from('appointment_clients').delete().eq('appointment_id', appt.id).in('client_id', remove));
            if (moved) {
              await q(from('appointment_clients').update({ status: 'open' }).eq('appointment_id', appt.id).eq('status', 'confirmed'));
              for (const cid of chosen) await rpc('coach_send_message', { cid, p_title: 'PT-Termin verschoben', p_body: 'Neu: ' + fmtDateTime(startsAt) });
            }
            saved.push(appt.id);
          } else {
            const n = Math.max(1, Math.min(26, parseNum(repeat.value) || 1));
            const series = n > 1 ? crypto.randomUUID() : null;
            for (let i = 0; i < n; i++) {
              const s = new Date(startsAt.getTime() + i * 7 * 864e5);
              const row = (await q(from('appointments').insert({ ...base, starts_at: s.toISOString(), series_id: series }).select()))[0];
              await q(from('appointment_clients').insert([...chosen].map((client_id) => ({ appointment_id: row.id, client_id }))));
              saved.push(row.id);
            }
          }
          syncCalendar(saved);
          toast('Termin gespeichert');
          return true;
        } catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

/** Push to Max' Google Calendar (only if configured on the server). Fire and forget. */
function syncCalendar(ids, action = 'upsert') {
  api('gcal', { action, ids }).catch((e) => { if (!/nicht eingerichtet|404/.test(e.message)) console.warn('gcal', e.message); });
}

/**
 * Coach only: live Google Maps preview of an address (to check it's the right place).
 * Clients never see an embedded map – they only get the address and a link to their maps app.
 */
function mapPreview(addressInput) {
  const box = h('div', { class: 'map-preview', hidden: true });
  let timer = null;
  const update = () => {
    const a = addressInput.value.trim();
    if (a.length < 6) { box.hidden = true; box.replaceChildren(); return; }
    const src = `https://www.google.com/maps?q=${encodeURIComponent(a)}&hl=de&z=16&output=embed`;
    box.hidden = false;
    box.replaceChildren(
      h('iframe', { src, title: 'Kartenvorschau', loading: 'lazy', referrerpolicy: 'no-referrer' }),
      h('a', { class: 'link-btn small', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`, target: '_blank', rel: 'noopener noreferrer' }, 'In Google Maps öffnen'));
  };
  addressInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(update, 700); });
  update();
  return box;
}

async function manageLocations() {
  const locs = await q(from('locations').select('*').order('name'));
  const name = input({ placeholder: 'Name, z. B. Studio XY', maxlength: 120 });
  const address = input({ placeholder: 'Adresse', maxlength: 300 });
  const hint = input({ placeholder: 'Hinweis, z. B. Eingang hinten', maxlength: 500 });
  await modal('Orte', h('div', null,
    locs.length ? locs.map((l) => h('div', { class: 'list-row' },
      h('div', null, h('strong', null, l.name, !l.active ? ' (inaktiv)' : ''), h('div', { class: 'muted small' }, [l.address, l.hint].filter(Boolean).join(' · ')),
        l.address ? h('a', { class: 'link-btn small', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address)}`, target: '_blank', rel: 'noopener noreferrer' }, 'Auf Karte ansehen') : null),
      h('button', {
        type: 'button', class: 'link-btn', onclick: async () => {
          try { await q(from('locations').update({ active: !l.active }).eq('id', l.id)); toast(l.active ? 'Deaktiviert' : 'Aktiviert'); } catch (e) { showError(e); }
        }
      }, l.active ? 'Deaktivieren' : 'Aktivieren'))) : empty('Noch keine Orte.'),
    h('h3', null, 'Neuer Ort'), name, address, mapPreview(address), hint,
    h('p', { class: 'muted small' }, 'Die Kartenvorschau siehst nur du. Kunden bekommen die Adresse und einen Knopf, der ihre Karten-App öffnet.')), [
    { label: 'Schließen', kind: 'secondary', value: false },
    {
      label: 'Ort speichern', onClick: async () => {
        if (!name.value.trim()) { toast('Bitte Namen eingeben.', 'bad'); return undefined; }
        try { await q(from('locations').insert({ name: name.value.trim(), address: address.value.trim() || null, hint: hint.value.trim() || null })); toast('Ort gespeichert'); return true; }
        catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

async function closeAppointment(a, attendees, clientsById, refresh) {
  const state = new Map(attendees.map((x) => [x.client_id, x.status === 'cancelled_client' || x.status === 'cancelled_sick' ? x.status : 'attended']));
  const note = textarea({ value: a.coach_note || '', maxlength: 2000, placeholder: 'Technik, Befinden, nächstes Mal …' });
  let visible = a.coach_note_visible;
  await modal('Termin abschließen', h('div', null,
    attendees.map((x) => {
      const seg = segmented([['attended', 'war da'], ['no_show', 'nicht erschienen'], ['cancelled_sick', 'krank']], state.get(x.client_id), (v) => state.set(x.client_id, v));
      return field(`${clientsById.get(x.client_id)?.first_name || 'Kunde'}`, seg);
    }),
    field('Notiz nach dem Termin', note),
    toggle('Kunde darf die Notiz sehen', visible, (v) => { visible = v; }),
    h('p', { class: 'hint muted' }, '„war da“ bucht automatisch −1 vom PT-Guthaben.')), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Speichern', onClick: async () => {
        try {
          await q(from('appointments').update({ status: 'done', coach_note: note.value.trim() || null, coach_note_visible: visible }).eq('id', a.id));
          for (const [cid, st] of state) await q(from('appointment_clients').update({ status: st }).eq('appointment_id', a.id).eq('client_id', cid));
          toast('Termin abgeschlossen'); refresh(); return true;
        } catch (e) { showError(e); return undefined; }
      }
    }
  ]);
}

const REQ_KIND = { pt: 'Personal Training', call: 'Online-Call', other: 'Termin' };

/** Open appointment requests from clients (they write what they need and when they can) */
async function requestsCard(reload) {
  const reqs = await q(from('appointment_requests').select('*, clients(first_name, last_name)').eq('status', 'open').order('created_at'));
  if (!reqs.length) return null;
  const done = async (r, patch) => {
    await q(from('appointment_requests').update({ ...patch, handled_at: new Date().toISOString() }).eq('id', r.id));
    reload();
  };
  return card(`Terminanfragen (${reqs.length})`,
    reqs.map((r) => h('div', { class: 'req-row' },
      h('div', { class: 'req-head' }, h('strong', null, `${r.clients?.first_name || 'Kunde'} ${r.clients?.last_name || ''}`.trim()),
        badge(REQ_KIND[r.kind] || 'Termin', r.kind === 'call' ? 'accent' : ''), h('small', { class: 'muted' }, relDay(iso(new Date(r.created_at))))),
      h('p', { class: 'prewrap' }, r.message),
      h('div', { class: 'row-actions wrap' },
        h('button', {
          type: 'button', class: 'small', onclick: async () => {
            const saved = await editAppointment(null, { presetClient: r.client_id, presetKind: r.kind === 'call' ? 'call' : 'strength', presetNote: '' });
            if (saved) { try { await done(r, { status: 'scheduled' }); toast('Anfrage erledigt'); } catch (e) { showError(e); } }
          }
        }, 'Termin anlegen'),
        h('button', {
          type: 'button', class: 'link-btn danger', onclick: async () => {
            const reply = textarea({ maxlength: 1000, placeholder: 'z. B. Donnerstag geht leider nicht – wie wäre Samstag 10 Uhr?' });
            const ok = await modal('Anfrage ablehnen', h('div', null, h('p', { class: 'muted small' }, 'Der Kunde bekommt deine Antwort als Nachricht in der App.'), reply), [
              { label: 'Abbrechen', kind: 'secondary', value: false }, { label: 'Senden', value: true }]);
            if (!ok) return;
            try { await done(r, { status: 'declined', coach_reply: reply.value.trim() || null }); toast('Antwort gesendet'); } catch (e) { showError(e); }
          }
        }, 'Ablehnen / antworten'),
        h('button', {
          type: 'button', class: 'link-btn', onclick: async () => { try { await done(r, { status: 'scheduled' }); toast('Als erledigt markiert'); } catch (e) { showError(e); } }
        }, 'Erledigt')))));
}

async function renderCalendar(el) {
  let view = sessionStorage.getItem('mx_cal_view') || 'week';
  let anchor = weekStart(today());
  const body = h('div');
  const reqBox = h('div');

  const load = async () => {
    clear(body).append(h('p', { class: 'muted' }, 'Lädt …'));
    requestsCard(load).then((c) => { clear(reqBox); if (c) reqBox.append(c); }).catch((e) => console.warn('requests', e));
    const fromD = view === 'week' ? anchor : today();
    const toD = view === 'week' ? addDays(anchor, 7) : addDays(today(), 60);
    const appts = await q(from('appointments').select('*, appointment_clients(client_id, status, late_cancel)')
      .gte('starts_at', new Date(fromD + 'T00:00').toISOString()).lt('starts_at', new Date(toD + 'T00:00').toISOString()).order('starts_at'));
    const clients = await q(from('clients').select('id, first_name, last_name'));
    const byId = new Map(clients.map((c) => [c.id, c]));
    const locs = await q(from('locations').select('*'));
    clear(body);

    const row = (a) => {
      const loc = locs.find((l) => l.id === a.location_id);
      const names = a.appointment_clients.map((x) => {
        const c = byId.get(x.client_id);
        return `${c?.first_name || '?'}${x.status !== 'open' ? ' (' + ATT[x.status] + (x.late_cancel ? ', kurzfristig' : '') + ')' : ''}`;
      }).join(', ');
      return h('div', { class: 'card' + (a.status === 'cancelled' ? ' faded' : '') },
        h('div', { class: 'ex-head' },
          h('strong', null, fmtTime(a.starts_at), ' · ', names),
          badge(a.status === 'planned' ? 'geplant' : a.status === 'done' ? 'durchgeführt' : a.status === 'cancelled' ? 'abgesagt' : 'verschoben', a.status === 'done' ? 'ok' : '')),
        h('p', { class: 'muted small' }, [kindLabel(a.kind), `${a.duration_min} min`, loc?.name, a.series_id ? 'Serie' : null].filter(Boolean).join(' · ')),
        a.note ? h('p', { class: 'hint' }, a.note) : null,
        h('div', { class: 'row-actions wrap' },
          a.status === 'planned' ? meetButton(a, true) : null,
          a.status === 'planned' ? a.appointment_clients.map((x) => h('a', { class: 'link-btn', href: `#/c/kunde/${x.client_id}?tab=training&pt=${a.id}` }, `Loggen: ${byId.get(x.client_id)?.first_name}`)) : null,
          a.status === 'planned' ? h('button', { type: 'button', class: 'link-btn', onclick: () => closeAppointment(a, a.appointment_clients, byId, load) }, 'Abschließen') : null,
          h('button', { type: 'button', class: 'link-btn', onclick: async () => { if (await editAppointment(a)) load(); } }, 'Bearbeiten'),
          a.status === 'planned' ? h('button', {
            type: 'button', class: 'link-btn danger', onclick: async () => {
              if (!await confirmDialog('Termin absagen? Die Kunden werden benachrichtigt.', { ok: 'Absagen', danger: true })) return;
              try {
                await q(from('appointments').update({ status: 'cancelled' }).eq('id', a.id));
                await q(from('appointment_clients').update({ status: 'cancelled_coach' }).eq('appointment_id', a.id).in('status', ['open', 'confirmed']));
                for (const x of a.appointment_clients) await rpc('coach_send_message', { cid: x.client_id, p_title: 'PT-Termin abgesagt', p_body: fmtDateTime(a.starts_at) });
                syncCalendar([a.id], 'delete');
                load();
              } catch (e) { showError(e); }
            }
          }, 'Absagen') : null));
    };

    if (view === 'week') {
      body.append(h('div', { class: 'row-actions' },
        h('button', { type: 'button', class: 'link-btn', onclick: () => { anchor = addDays(anchor, -7); load(); } }, '← Woche'),
        h('strong', null, `${fmt(anchor)} – ${fmt(addDays(anchor, 6))}`),
        h('button', { type: 'button', class: 'link-btn', onclick: () => { anchor = addDays(anchor, 7); load(); } }, 'Woche →')));
      for (let i = 0; i < 7; i++) {
        const d = addDays(anchor, i);
        const dayAppts = appts.filter((a) => iso(new Date(a.starts_at)) === d);
        body.append(h('h3', { class: 'day-head' + (d === today() ? ' today' : '') }, `${WD_SHORT[new Date(d).getDay()]} ${fmt(d, { year: false })}`),
          dayAppts.length ? dayAppts.map(row) : h('p', { class: 'muted small' }, '–'));
      }
    } else {
      if (!appts.length) body.append(empty('Keine Termine in den nächsten 60 Tagen.'));
      let lastDay = null;
      for (const a of appts) {
        const d = iso(new Date(a.starts_at));
        if (d !== lastDay) { body.append(h('h3', { class: 'day-head' }, fmt(d))); lastDay = d; }
        body.append(row(a));
      }
    }
  };

  el.append(
    pageHead('Termine', 'Personal Training',
      h('button', { type: 'button', onclick: async () => { if (await editAppointment(null)) load(); } }, '+ Termin'),
      h('button', { type: 'button', class: 'secondary', onclick: () => manageLocations().then(load) }, 'Orte')),
    reqBox,
    segmented([['week', 'Woche'], ['list', 'Liste']], view, (v) => { view = v; sessionStorage.setItem('mx_cal_view', v); load(); }),
    body);
  await load();
}

export default {
  id: 'pt',
  name: 'Personal Training',
  order: 3,
  icon: 'people',
  color: 'indigo',
  description: 'Termine, Orte, PT-Guthaben und Live-Logging im Training',
  requires: { unlock: 'pt' },

  async today(ctx) {
    const appts = (await clientAppointments(ctx.client.id, new Date().toISOString()))
      .filter((a) => a.status === 'planned' && !a.my_status.startsWith('cancelled'));
    if (!appts.length) return null;
    const locs = await loadLocations(ctx.client.coach_id);
    return apptCard(ctx, appts[0], locs);
  },

  async training(ctx) {
    const appts = (await clientAppointments(ctx.client.id, addDays(today(), -1) + 'T00:00:00Z'));
    const bal = await balance(ctx.client.id);
    const locs = await loadLocations(ctx.client.coach_id);
    const upcoming = appts.filter((a) => a.status === 'planned' && new Date(a.starts_at) > new Date());
    const wrap = h('div');
    wrap.append(card('Personal Training',
      h('p', null, 'Guthaben: ', h('strong', { class: bal <= 0 ? 'bad-text' : '' }, `${bal} PT`)),
      upcoming.length ? null : empty('Keine anstehenden Termine.')));
    upcoming.forEach((a) => wrap.append(apptCard(ctx, a, locs)));
    return wrap;
  },

  async analysis(ctx) {
    const ledger = await q(from('pt_ledger').select('*').eq('client_id', ctx.client.id).order('created_at', { ascending: false }).limit(50));
    const bal = ledger.reduce((a, l) => a + l.delta, 0);
    const REASON = { payment: 'Zahlung', block: 'Block', session: 'Termin', no_show: 'nicht erschienen', late_cancel: 'kurzfristige Absage', correction: 'Korrektur' };
    return card('PT-Guthaben',
      h('p', null, 'Aktueller Stand: ', h('strong', { class: bal < 0 ? 'bad-text' : '' }, `${bal} PT`)),
      ledger.length ? ledger.map((l) => h('div', { class: 'list-row' },
        h('span', null, `${fmt(l.day)} · ${REASON[l.reason] || l.reason}${l.note ? ' · ' + l.note : ''}`),
        h('strong', { class: l.delta > 0 ? 'ok-text' : '' }, (l.delta > 0 ? '+' : '') + l.delta))) : empty('Noch keine Buchungen.'));
  },

  async coach(ctx) {
    const bal = await balance(ctx.client.id);
    const appts = await clientAppointments(ctx.client.id, addDays(today(), -30) + 'T00:00:00Z');
    const book = async (delta, reason) => {
      const note = input({ maxlength: 500, placeholder: 'Notiz (optional)' });
      const n = input({ type: 'number', value: Math.abs(delta), min: 1, max: 100 });
      const ok = await modal(delta > 0 ? 'PT gutschreiben' : 'PT abziehen', h('div', null, field('Anzahl', n), field('Notiz', note)), [
        { label: 'Abbrechen', kind: 'secondary', value: false }, { label: 'Buchen', value: true }]);
      if (!ok) return;
      try {
        await q(from('pt_ledger').insert({ client_id: ctx.client.id, delta: Math.sign(delta) * (parseNum(n.value) || 1), reason, note: note.value.trim() || null }));
        toast('Gebucht'); ctx.refresh();
      } catch (e) { showError(e); }
    };
    const frag = document.createDocumentFragment();
    frag.append(
      card('PT-Kontostand',
        h('p', null, 'Guthaben: ', h('strong', { class: bal < 0 ? 'bad-text' : bal <= 1 ? 'warn-text' : '' }, `${bal} PT`)),
        h('div', { class: 'row-actions wrap' },
          h('button', { type: 'button', class: 'secondary', onclick: () => book(1, 'payment') }, '+ Zahlung (PT)'),
          h('button', { type: 'button', class: 'secondary', onclick: () => book(10, 'block') }, '+ Block'),
          h('button', { type: 'button', class: 'secondary', onclick: () => book(-1, 'correction') }, '− Korrektur'),
          h('button', { type: 'button', onclick: async () => { if (await editAppointment(null, { presetClient: ctx.client.id })) ctx.refresh(); } }, '+ Termin'))),
      card('Termine (letzte 30 Tage + kommende)',
        appts.length ? appts.map((a) => h('div', { class: 'list-row' },
          h('span', null, `${fmtDateTime(a.starts_at)} · ${kindLabel(a.kind)}`),
          badge(ATT[a.my_status] + (a.late_cancel ? ', kurzfristig' : ''), a.my_status === 'attended' ? 'ok' : a.late_cancel ? 'warn' : ''))) : empty('Keine Termine.')));
    const ptAnalysis = await this.analysis(ctx);
    frag.append(ptAnalysis);
    return frag;
  },

  async summary(ctx, fromDay, toDay) {
    const appts = (await clientAppointments(ctx.client.id, fromDay + 'T00:00:00Z')).filter((a) => a.starts_at.slice(0, 10) <= toDay);
    const attended = appts.filter((a) => a.my_status === 'attended').length;
    const missed = appts.filter((a) => a.my_status === 'no_show' || a.late_cancel).length;
    return [{ label: 'Personal Training', value: `${attended} durchgeführt${missed ? `, ${missed} verpasst/kurzfristig abgesagt` : ''}` }];
  },

  routes: [
    { path: '/c/termine', role: 'coach', nav: { label: 'Termine', icon: '' }, render: (el) => renderCalendar(el) }
  ]
};
