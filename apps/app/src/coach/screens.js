// Coach routes.
import { h, pageHead } from '../core/ui.js';
import { renderCoachHome } from './home.js';
import { renderClients } from './clients.js';
import { renderClient } from './client.js';
import { renderCheckins } from './checkins.js';
import { renderData } from './data.js';
import { renderSettings } from './settings.js';
import { renderExercises } from './exercises.js';

function renderMore(el, app) {
  const moduleLinks = app.modules.flatMap((m) => (m.routes || []).filter((r) => r.role === 'coach' && r.nav && r.path !== '/c/termine'))
    .map((r) => [r.path, r.nav.icon + ' ' + r.nav.label]);
  const links = [
    ...moduleLinks,
    ['/c/uebungen', '🏋️ Übungen'],
    ['/c/daten', '💾 Daten & Backup'],
    ['/c/einstellungen', '⚙️ Einstellungen']
  ];
  el.append(pageHead('Mehr'), h('div', { class: 'list' }, links.map(([p, l]) => h('a', { class: 'list-row card-link', href: '#' + p }, h('span', null, l), h('span', { class: 'chev' }, '›')))));
}

export function register(route, app) {
  route('/c', (el) => renderCoachHome(el, app));
  route('/c/kunden', (el, p, query) => renderClients(el, app, query));
  route('/c/kunde/:id', (el, p, query) => renderClient(el, app, p, query));
  route('/c/checkins', (el) => renderCheckins(el, app));
  route('/c/daten', (el) => renderData(el, app));
  route('/c/einstellungen', (el) => renderSettings(el, app));
  route('/c/uebungen', (el) => renderExercises(el, app));
  route('/c/mehr', (el) => renderMore(el, app));
}
