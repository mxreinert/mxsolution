// Client routes.
import { h, card, backLink } from '../core/ui.js';
import { renderToday, renderPause } from './today.js';
import { renderLog } from './log.js';
import { renderTraining } from './training.js';
import { renderAnalysis } from './analysis.js';
import { renderCheckin } from './checkin.js';
import { renderProfile } from './profile.js';
import { renderOnboarding } from './onboarding.js';

function renderHelp(el, app) {
  const wa = app.settings.whatsapp;
  el.append(backLink('#/profil'),
    h('header', { class: 'page-head' }, h('div', null, h('h1', null, 'Hilfe & FAQ'))),
    app.settings.help_text ? card(null, h('p', { class: 'prewrap' }, app.settings.help_text)) : null,
    app.settings.faq.map((f) => h('details', { class: 'card faq' }, h('summary', null, f.q), h('p', { class: 'prewrap' }, f.a))),
    wa ? h('a', { class: 'button', href: `https://wa.me/${wa}`, target: '_blank', rel: 'noopener noreferrer' }, 'Frage an Max auf WhatsApp') : null);
}

function renderPrivacy(el, app) {
  el.append(backLink('#/profil'),
    h('header', { class: 'page-head' }, h('div', null, h('h1', null, 'Datenschutz'))),
    card(null, h('p', { class: 'prewrap' }, app.settings.privacy_text),
      h('p', { class: 'muted small' }, 'Gespeichert wird auch, wann du die App öffnest (Nutzungsstatistik für Max). Nach 90 Tagen werden die Einzelzeiten zu Tageswerten zusammengefasst.'),
      h('p', { class: 'muted small' }, 'Auskunft, Export, Löschung, Widerruf: über Max.')));
}

export function register(route, app) {
  route('/heute', (el) => renderToday(el, app));
  route('/pause', (el) => renderPause(el, app));
  route('/eintragen', (el, p, query) => renderLog(el, app, query));
  route('/training', (el) => renderTraining(el, app));
  route('/auswertung', (el) => renderAnalysis(el, app));
  route('/checkin', (el) => renderCheckin(el, app));
  route('/profil', (el) => renderProfile(el, app));
  route('/start', (el) => renderOnboarding(el, app));
  route('/hilfe', (el) => renderHelp(el, app));
  route('/datenschutz', (el) => renderPrivacy(el, app));
}
