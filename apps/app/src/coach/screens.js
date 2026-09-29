// Coach routes.
import { h, pageHead, icon } from '../core/ui.js';
import { renderCoachHome } from './home.js';
import { renderClients } from './clients.js';
import { renderClient } from './client.js';
import { renderCheckins } from './checkins.js';
import { renderData } from './data.js';
import { renderSettings } from './settings.js';
import { renderExercises } from './exercises.js';
import { renderModulesPage } from './modules-page.js';
import { tile } from '../core/ui.js';

function renderMore(el, app) {
  const moduleLinks = app.modules.flatMap((m) => (m.routes || []).filter((r) => r.role === 'coach' && r.nav && r.path !== '/c/termine')
    .map((r) => [r.path, r.nav.label, m.icon || 'grid', m.color || 'accent']));
  const links = [
    ['/c/module', 'Module', 'grid', 'accent'],
    ...moduleLinks,
    ['/c/uebungen', 'Übungen', 'dumbbell', 'indigo'],
    ['/c/daten', 'Daten & Backup', 'download', 'teal'],
    ['/c/einstellungen', 'Einstellungen', 'gear', 'gray']
  ];
  el.append(pageHead('Mehr'), h('div', { class: 'list' }, links.map(([p, l, ic, col]) => h('a', { class: 'list-row card-link', href: '#' + p },
    h('div', { class: 'row-main' }, tile(ic, col, 30), h('span', null, l)), h('span', { class: 'chev' }, icon('chevron', { size: 17 }))))));
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
  route('/c/module', (el) => renderModulesPage(el, app));
}
