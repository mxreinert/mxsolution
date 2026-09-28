// Profil: avatar, goal/concept, theme, devices, notifications, help, privacy, logout.
import { h, card, select, input, field, toggle, toast, showError, modal, compressImage, confirmDialog, fmtNum, clear } from '../core/ui.js';
import { q, from, fileUrl, uploadFile, removeFiles, sb } from '../core/db.js';
import { logout } from '../core/auth.js';
import { GOALS } from '../core/goals.js';
import { WEEKDAYS, fmt } from '../core/dates.js';
import { pushState, enablePush, disablePush } from '../core/push.js';
import { reloadOwnClient } from '../core/app.js';

export const THEMES = [['', 'Wie Handy-Einstellung'], ['light', 'Hell'], ['dark', 'Dunkel'], ['white-blue', 'Weiß-Blau'], ['black-blue', 'Schwarz-Blau']];
const WATCHES = [['', '– keine –'], ['apple', 'Apple Watch'], ['garmin', 'Garmin'], ['fitbit', 'Fitbit'], ['samsung', 'Samsung'], ['polar', 'Polar'], ['whoop', 'Whoop'], ['phone', 'nur Handy'], ['other', 'andere']];
const FOOD_APPS = [['', '– keine –'], ['yazio', 'Yazio'], ['mfp', 'MyFitnessPal'], ['fddb', 'FDDB'], ['lifesum', 'Lifesum'], ['other', 'andere']];

export function avatarPath(clientId) { return `${clientId}/avatar.jpg`; }

export async function avatarEl(clientId, size = 72) {
  const url = await fileUrl(avatarPath(clientId));
  const img = h('img', { class: 'avatar', width: size, height: size, alt: '' });
  if (url) {
    img.src = url;
    img.addEventListener('error', () => img.replaceWith(h('div', { class: 'avatar placeholder', style: { width: size + 'px', height: size + 'px' } }, '👤')));
    return img;
  }
  return h('div', { class: 'avatar placeholder', style: { width: size + 'px', height: size + 'px' } }, '👤');
}

async function saveSettings(app, patch) {
  await q(from('client_settings').upsert({ client_id: app.client.id, ...patch }, { onConflict: 'client_id' }));
  app.client._settings = { ...app.client._settings, ...patch };
}

export async function renderProfile(el, app) {
  const c = app.client;
  const s = c._settings || {};
  const t = c.targets || {};

  // avatar
  const avWrap = h('div', { class: 'avatar-wrap' }, await avatarEl(c.id, 88));
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    try {
      const blob = await compressImage(file.files[0], { maxSize: 256, quality: 0.7, square: true });
      await uploadFile(avatarPath(c.id), blob);
      clear(avWrap).append(await avatarEl(c.id, 88));
      toast('Profilbild gespeichert');
    } catch (e) { showError(e); }
  });

  el.append(h('header', { class: 'page-head profile-head' }, avWrap,
    h('div', null, h('h1', null, `${c.first_name} ${c.last_name || ''}`), h('p', { class: 'muted' }, '@' + app.profile.username),
      h('div', { class: 'row-actions' },
        h('button', { type: 'button', class: 'link-btn', onclick: () => file.click() }, 'Bild ändern'),
        h('button', {
          type: 'button', class: 'link-btn danger', onclick: async () => {
            if (!await confirmDialog('Profilbild löschen?')) return;
            try { await removeFiles([avatarPath(c.id)]); clear(avWrap).append(await avatarEl('none', 88)); } catch (e) { showError(e); }
          }
        }, 'löschen')), file)));

  // concept
  const targetRows = [
    ['kcal', 'Kalorien', 'kcal'], ['kcal_rest', 'Kalorien Ruhetag', 'kcal'], ['protein_g', 'Protein', 'g'], ['carbs_g', 'Kohlenhydrate', 'g'], ['fat_g', 'Fett', 'g'],
    ['steps', 'Schritte', ''], ['sleep_h', 'Schlaf', 'h'], ['weekly_change_kg', 'Gewicht pro Woche', 'kg'], ['cardio_min_week', 'Cardio pro Woche', 'min']
  ].filter(([k]) => t[k] != null);
  el.append(card('Dein Ziel',
    h('p', null, h('strong', null, GOALS[c.goal]?.label || 'noch offen'), c.goal_end ? ` · bis ${fmt(c.goal_end)}` : ''),
    c.milestones ? h('p', { class: 'prewrap muted' }, c.milestones) : null,
    targetRows.length ? h('table', { class: 'kv' }, h('tbody', null, targetRows.map(([k, l, u]) => h('tr', null, h('th', null, l), h('td', null, `${fmtNum(t[k], k === 'sleep_h' || k === 'weekly_change_kg' ? 1 : 0)} ${u}`))))) : null,
    h('p', { class: 'muted small' }, `Check-in: jeden ${WEEKDAYS[c.checkin_weekday]}`)));

  // theme
  const theme = select(THEMES, s.theme || '');
  theme.addEventListener('change', async () => {
    const v = theme.value || null;
    try { localStorage.setItem('mx_theme', v || ''); } catch (e) { /* ignore */ }
    v ? document.documentElement.setAttribute('data-theme', v) : document.documentElement.removeAttribute('data-theme');
    try { await saveSettings(app, { theme: v }); } catch (e) { showError(e); }
  });

  // devices
  const watch = select(WATCHES, s.devices?.watch || '');
  const food = select(FOOD_APPS, s.devices?.nutrition_app || '');
  const saveDevices = async () => { try { await saveSettings(app, { devices: { watch: watch.value || null, nutrition_app: food.value || null } }); toast('Gespeichert'); } catch (e) { showError(e); } };
  watch.addEventListener('change', saveDevices);
  food.addEventListener('change', saveDevices);

  el.append(card('Darstellung & Geräte', field('Farbmodus', theme), field('Uhr / Tracker', watch), field('Ernährungs-App', food),
    h('p', { class: 'muted small' }, 'Die App liest keine Daten automatisch aus Uhr oder Apps aus – du trägst die Werte abends selbst ein.')));

  // notifications
  el.append(await notificationsCard(app));

  // module profile cards (e.g. Hevy)
  const ctx = await app.buildCtx(c, new Date().toISOString().slice(0, 10));
  for (const m of app.modules.filter((x) => x.profile && app.isActive(x, c))) {
    try { el.append(await m.profile(ctx)); } catch (e) { console.warn('profile', m.id, e); }
  }

  const wa = app.settings.whatsapp;
  el.append(card('Hilfe & Datenschutz',
    h('a', { class: 'list-row card-link', href: '#/hilfe' }, h('span', null, 'Hilfe & FAQ'), h('span', { class: 'chev' }, '›')),
    h('a', { class: 'list-row card-link', href: '#/datenschutz' }, h('span', null, 'Datenschutz'), h('span', { class: 'chev' }, '›')),
    wa ? h('a', { class: 'list-row card-link', href: `https://wa.me/${wa}`, target: '_blank', rel: 'noopener noreferrer' }, h('span', null, 'Max auf WhatsApp schreiben'), h('span', { class: 'chev' }, '›')) : null,
    h('p', { class: 'muted small' }, 'Export oder Löschung deiner Daten: bitte bei Max anfragen.')));

  el.append(h('button', { type: 'button', class: 'secondary', onclick: changePassword }, 'Passwort ändern'),
    h('button', { type: 'button', class: 'secondary', onclick: logout }, 'Abmelden'));
}

async function changePassword() {
  const p1 = input({ type: 'password', autocomplete: 'new-password', minlength: 10 });
  const p2 = input({ type: 'password', autocomplete: 'new-password', minlength: 10 });
  await modal('Passwort ändern', h('div', null, field('Neues Passwort (mind. 10 Zeichen)', p1), field('Wiederholen', p2)), [
    { label: 'Abbrechen', kind: 'secondary', value: false },
    {
      label: 'Speichern', onClick: async () => {
        if (p1.value.length < 10) { toast('Mindestens 10 Zeichen.', 'bad'); return undefined; }
        if (p1.value !== p2.value) { toast('Passwörter stimmen nicht überein.', 'bad'); return undefined; }
        const { error } = await sb.auth.updateUser({ password: p1.value });
        if (error) { toast(error.code === 'same_password' ? 'Bitte ein anderes Passwort wählen.' : 'Hat nicht geklappt.', 'bad'); return undefined; }
        toast('Passwort geändert'); return true;
      }
    }
  ]);
}

async function notificationsCard(app) {
  const c = app.client;
  const s = c._settings || {};
  const defaults = app.settings.reminders;
  const reminders = structuredClone({ ...defaults, ...(s.reminders || {}) });
  const state = await pushState();
  const pushInfo = {
    on: '✅ Push ist aktiv auf diesem Gerät.',
    off: 'Push ist aus.',
    denied: 'Push ist im Browser blockiert. In den Browser-/Handy-Einstellungen für diese Seite erlauben.',
    unsupported: 'Dieses Gerät/dieser Browser unterstützt keine Push-Benachrichtigungen. Du siehst Hinweise beim Öffnen der App.',
    'needs-homescreen': 'iPhone: Push geht nur, wenn die App zum Homescreen hinzugefügt wurde (Teilen → „Zum Home-Bildschirm“, iOS 16.4+).'
  }[state];

  const rows = Object.entries(reminders).map(([key, r]) => {
    const time = input({ type: 'time', value: r.time || '', step: 300, class: 'mini' });
    const cb = toggle(defaults[key]?.label || r.label || key, r.on !== false, (v) => { r.on = v; });
    time.addEventListener('change', () => { r.time = time.value; });
    return h('div', { class: 'list-row' }, cb, time);
  });
  const qFrom = input({ type: 'time', value: (s.quiet_from || '22:00').slice(0, 5), class: 'mini' });
  const qTo = input({ type: 'time', value: (s.quiet_to || '07:00').slice(0, 5), class: 'mini' });
  const muted = s.mute_until && new Date(s.mute_until) > new Date();
  const mute = select([['', muted ? `stumm bis ${fmt(s.mute_until)}` : 'nicht stumm'], ['off', 'Stummschaltung aufheben'], ['1', '1 Tag stumm'], ['3', '3 Tage stumm'], ['7', '1 Woche stumm'], ['forever', 'dauerhaft stumm']], '');

  return card('Benachrichtigungen',
    h('p', { class: 'muted small' }, pushInfo),
    state === 'off' ? h('button', { type: 'button', onclick: async () => { try { await enablePush(); toast('Push aktiviert'); location.reload(); } catch (e) { showError(e); } } }, 'Push aktivieren') : null,
    state === 'on' ? h('button', { type: 'button', class: 'link-btn', onclick: async () => { try { await disablePush(); toast('Push aus'); location.reload(); } catch (e) { showError(e); } } }, 'Push auf diesem Gerät ausschalten') : null,
    h('h4', null, 'Erinnerungen'), rows,
    h('div', { class: 'grid2' }, field('Ruhezeit von', qFrom), field('bis', qTo)),
    field('Stumm-Modus', mute),
    h('p', { class: 'muted small' }, 'Nach der Stummschaltung bekommst du einmal eine Übersicht, was neu ist – nur wenn wirklich etwas neu ist.'),
    h('button', {
      type: 'button', class: 'secondary', onclick: async () => {
        let muteUntil = s.mute_until || null;
        if (mute.value === 'off') muteUntil = null;
        else if (mute.value === 'forever') muteUntil = '2999-12-31T00:00:00Z';
        else if (mute.value) muteUntil = new Date(Date.now() + Number(mute.value) * 864e5).toISOString();
        try {
          await saveSettings(app, { reminders, quiet_from: qFrom.value || '22:00', quiet_to: qTo.value || '07:00', mute_until: muteUntil });
          await reloadOwnClient();
          toast('Gespeichert');
        } catch (e) { showError(e); }
      }
    }, 'Benachrichtigungen speichern'));
}
