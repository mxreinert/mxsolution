// Coach settings: change rules and texts without code and without deploy.
import { h, card, input, textarea, field, toast, showError, pageHead, parseNum, toggle, clear } from '../core/ui.js';
import { q, from } from '../core/db.js';
import { logout } from '../core/auth.js';
import { DEFAULT_SETTINGS, mergeSettings } from '../core/settings.js';

const THRESHOLDS = [
  ['weight_delta_kg', 'Warnung Gewicht: Abweichung zum letzten Eintrag (kg)'],
  ['kcal_min', 'Warnung kcal unter'], ['kcal_max', 'Warnung kcal über'],
  ['steps_max', 'Warnung Schritte über'], ['sleep_max_h', 'Warnung Schlaf über (h)'],
  ['set_jump_pct', 'Warnung Satzgewicht: Abweichung zum letzten Mal (%)'],
  ['ampel_yellow_days', 'Ampel gelb ab X Tagen ohne Eintrag'], ['ampel_red_days', 'Ampel rot ab X Tagen ohne Eintrag'],
  ['mood_low_value', 'Motivation gilt als niedrig bis'], ['mood_low_days', '… an X Tagen in Folge → rot']
];

export async function renderSettings(el, app) {
  const s = mergeSettings(app.rawCoachSettings);
  const wa = input({ value: s.whatsapp || '', placeholder: 'z. B. 352621123456 (nur Ziffern, mit Ländervorwahl)', inputmode: 'numeric' });
  const cancel = input({ type: 'number', min: 0, max: 168, value: s.cancel_hours });
  const th = Object.fromEntries(THRESHOLDS.map(([k]) => [k, input({ type: 'number', step: 'any', value: s.thresholds[k] })]));
  const reminders = structuredClone(s.reminders);
  const remRows = Object.entries(reminders).map(([k, r]) => {
    const t = input({ type: 'time', value: r.time, class: 'mini' });
    t.addEventListener('change', () => { r.time = t.value; });
    return h('div', { class: 'list-row' }, toggle(r.label || k, r.on !== false, (v) => { r.on = v; }), t);
  });
  const privacy = textarea({ value: s.privacy_text, rows: 6, maxlength: 5000 });
  const help = textarea({ value: s.help_text || '', rows: 3, maxlength: 3000 });
  const faq = structuredClone(s.faq);
  const faqBox = h('div');
  const drawFaq = () => clear(faqBox).append(...faq.map((f, i) => {
    const qIn = input({ value: f.q, maxlength: 200 });
    const aIn = textarea({ value: f.a, maxlength: 2000 });
    qIn.addEventListener('input', () => { f.q = qIn.value; });
    aIn.addEventListener('input', () => { f.a = aIn.value; });
    return h('div', { class: 'faq-edit' }, qIn, aIn, h('button', { type: 'button', class: 'link-btn danger', onclick: () => { faq.splice(i, 1); drawFaq(); } }, 'Frage entfernen'));
  }), h('button', { type: 'button', class: 'link-btn', onclick: () => { faq.push({ q: '', a: '' }); drawFaq(); } }, '+ Frage'));
  drawFaq();

  el.append(pageHead('Einstellungen', 'Gilt sofort für alle Kunden – ohne Code, ohne Deploy.'),
    card('Kontakt & Termine', field('WhatsApp-Nummer', wa), field('Absagefrist PT (Stunden)', cancel)),
    card('Warngrenzen & Ampel', h('div', { class: 'grid2' }, THRESHOLDS.map(([k, l]) => field(l, th[k])))),
    card('Standard-Erinnerungen', remRows, h('p', { class: 'muted small' }, 'Kunden können Zeiten selbst ändern oder einzelne abschalten.')),
    card('Texte', field('Datenschutz-Hinweis (Onboarding)', privacy), field('Hilfetext (optional)', help)),
    card('FAQ', faqBox),
    h('button', {
      type: 'button', class: 'sticky-save', onclick: async () => {
        const thresholds = {};
        THRESHOLDS.forEach(([k]) => { thresholds[k] = parseNum(th[k].value) ?? DEFAULT_SETTINGS.thresholds[k]; });
        const settings = {
          ...(app.rawCoachSettings || {}),
          whatsapp: wa.value.replace(/[^0-9]/g, ''), cancel_hours: parseNum(cancel.value) ?? 24,
          thresholds, reminders, privacy_text: privacy.value.trim() || DEFAULT_SETTINGS.privacy_text,
          help_text: help.value.trim(), faq: faq.filter((f) => f.q.trim() && f.a.trim())
        };
        try {
          await q(from('coach_settings').upsert({ coach_id: app.profile.id, settings }, { onConflict: 'coach_id' }));
          app.rawCoachSettings = settings;
          app.settings = mergeSettings(settings);
          toast('Einstellungen gespeichert');
        } catch (e) { showError(e); }
      }
    }, 'Speichern'),
    card('Konto', h('p', { class: 'muted small' }, 'Zwei-Faktor-Login ist für dein Coach-Konto Pflicht.'),
      h('button', { type: 'button', class: 'secondary', onclick: logout }, 'Abmelden')));
}
