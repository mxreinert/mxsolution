// Coach settings: only about Max himself (profile, contact, texts, account).
// Everything that concerns a client (reminders, warning limits, modules) is set per client.
import { h, card, input, textarea, toast, showError, pageHead, parseNum, clear, compressImage, srow as row } from '../core/ui.js';
import { tile } from '../core/icons.js';
import { q, from, uploadFile, fileUrl, removeFiles } from '../core/db.js';
import { logout } from '../core/auth.js';
import { DEFAULT_SETTINGS, mergeSettings } from '../core/settings.js';

export const coachAvatarPath = (coachId) => `coach/${coachId}/avatar.jpg`;

export async function coachAvatar(coachId, size = 72) {
  const url = await fileUrl(coachAvatarPath(coachId));
  if (url) {
    const img = h('img', { class: 'avatar', width: size, height: size, alt: '', src: url });
    img.addEventListener('error', () => img.replaceWith(h('div', { class: 'avatar placeholder', style: { width: size + 'px', height: size + 'px' } }, 'M')));
    return img;
  }
  return h('div', { class: 'avatar placeholder', style: { width: size + 'px', height: size + 'px', fontWeight: '700', fontSize: size / 2.6 + 'px' } }, 'M');
}

export async function renderSettings(el, app) {
  const s = mergeSettings(app.rawCoachSettings);
  const uid = app.profile.id;

  // profile picture
  const avWrap = h('div', { class: 'avatar-wrap' }, await coachAvatar(uid, 84));
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    try {
      const blob = await compressImage(file.files[0], { maxSize: 320, quality: 0.75, square: true });
      await uploadFile(coachAvatarPath(uid), blob);
      clear(avWrap).append(await coachAvatar(uid, 84));
      toast('Profilbild gespeichert');
    } catch (e) { showError(e); }
  });

  const name = input({ value: s.display_name || 'Max Reinert', maxlength: 60 });
  const wa = input({ value: s.whatsapp || '', placeholder: 'z. B. +352 621 969 685', inputmode: 'tel' });
  const cancel = input({ type: 'number', min: 0, max: 168, value: s.cancel_hours });
  const privacy = textarea({ value: s.privacy_text, rows: 6, maxlength: 5000 });
  const help = textarea({ value: s.help_text || '', rows: 3, maxlength: 3000 });
  const faq = structuredClone(s.faq);
  const faqBox = h('div');
  const drawFaq = () => clear(faqBox).append(...faq.map((f, i) => {
    const qIn = input({ value: f.q, maxlength: 200, placeholder: 'Frage' });
    const aIn = textarea({ value: f.a, maxlength: 2000, placeholder: 'Antwort' });
    qIn.addEventListener('input', () => { f.q = qIn.value; });
    aIn.addEventListener('input', () => { f.a = aIn.value; });
    return h('div', { class: 'faq-edit' }, qIn, aIn, h('button', { type: 'button', class: 'link-btn danger', onclick: () => { faq.splice(i, 1); drawFaq(); } }, 'Frage entfernen'));
  }), h('button', { type: 'button', class: 'link-btn', onclick: () => { faq.push({ q: '', a: '' }); drawFaq(); } }, '+ Frage'));
  drawFaq();

  const save = async () => {
    const settings = {
      ...(app.rawCoachSettings || {}),
      display_name: name.value.trim() || 'Max Reinert',
      whatsapp: wa.value.replace(/[^0-9]/g, ''), cancel_hours: parseNum(cancel.value) ?? 24,
      privacy_text: privacy.value.trim() || DEFAULT_SETTINGS.privacy_text,
      help_text: help.value.trim(), faq: faq.filter((f) => f.q.trim() && f.a.trim())
    };
    try {
      await q(from('coach_settings').upsert({ coach_id: uid, settings }, { onConflict: 'coach_id' }));
      app.rawCoachSettings = settings;
      app.settings = mergeSettings(settings);
      toast('Gespeichert');
    } catch (e) { showError(e); }
  };

  // extra cards from modules (e.g. Hevy exercise mapping); each saves on its own
  const moduleCards = h('div');
  for (const m of app.modules.filter((x) => x.coachSettings)) {
    try { moduleCards.append(await m.coachSettings(app)); } catch (e) { console.warn('coachSettings', m.id, e); }
  }

  el.append(
    pageHead('Einstellungen', 'Dein Profil und deine Angaben. Alles zu Kunden stellst du direkt beim Kunden ein.'),
    card(null,
      h('div', { class: 'profile-head', style: { display: 'flex', gap: '16px', alignItems: 'center' } }, avWrap,
        h('div', null, h('div', { class: 'fc-title' }, s.display_name || 'Max Reinert'), h('div', { class: 'muted' }, 'Coach · @' + app.profile.username),
          h('div', { class: 'row-actions' },
            h('button', { type: 'button', class: 'link-btn', onclick: () => file.click() }, 'Bild ändern'),
            h('button', {
              type: 'button', class: 'link-btn danger', onclick: async () => {
                try { await removeFiles([coachAvatarPath(uid)]); clear(avWrap).append(await coachAvatar('none', 84)); } catch (e) { showError(e); }
              }
            }, 'Entfernen')), file)),
      h('p', { class: 'muted small' }, 'Deine Kunden sehen dein Profilbild z. B. beim Feedback.')),
    h('section', { class: 'card scard' },
      h('h3', { class: 'card-title' }, 'Profil & Kontakt'),
      row('Anzeigename', 'So erscheinst du bei deinen Kunden.', name),
      row('WhatsApp-Nummer', 'Gilt überall: Startseite („Melde dich für ein Coaching“), „Passwort vergessen?“, Hilfe und Profil deiner Kunden.', wa),
      row('Absagefrist Personal Training', 'Absagen später als X Stunden vor dem Termin gelten als kurzfristig.', h('div', { class: 'unit-input' }, cancel, h('span', null, 'Std.')))),
    h('section', { class: 'card scard' },
      h('h3', { class: 'card-title' }, 'Texte für Kunden'),
      row('Datenschutz-Hinweis', 'Wird im Onboarding und unter Profil → Datenschutz angezeigt.', null), privacy,
      row('Hilfetext', 'Optional, erscheint oben auf der Hilfe-Seite.', null), help),
    card('FAQ', faqBox),
    h('button', { type: 'button', class: 'sticky-save', onclick: save }, 'Speichern'),
    moduleCards,
    h('section', { class: 'card scard' },
      h('h3', { class: 'card-title' }, 'Konto'),
      row('Zwei-Faktor-Login', 'Für dein Coach-Konto Pflicht.', h('span', { class: 'badge ok' }, 'aktiv')),
      h('button', { type: 'button', class: 'secondary', onclick: () => logout('/coach.html') }, 'Abmelden')),
    h('p', { class: 'center' }, tile('info', 'gray', 22), h('span', { class: 'muted small' }, ' Erinnerungen, Warngrenzen und Module: beim jeweiligen Kunden im Tab „Module“ → „Allgemein“.')));
}
