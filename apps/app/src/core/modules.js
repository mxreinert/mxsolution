// Module registry. Modules never import each other; the app core wires them together.
//
// Module contract (all optional except id/name):
//   id, name, order
//   requires: { unlock: 'photos' } | { consent: 'cycle', clientSetting: 'cycle_enabled' }
//   coachOnly: true      -> never shown to clients
//   always: true         -> active for every client (coach tools like billing)
//   daily: [field]       -> fields in the evening check (daily_entries)
//   trackGroup: [keys]   -> one "Nicht getrackt" button for several fields
//   evening(ctx)         -> { el, save(day) } custom section in the evening check
//   annotations(ctx)     -> { markers, bands, hints } shared with all charts
//   today(ctx)           -> card for the Heute screen
//   training(ctx)        -> section in the Training tab
//   analysis(ctx)        -> cards for Auswertung (client + coach)
//   coach(ctx)           -> panel in the coach's client detail
//   profile(ctx)         -> card in the client's profile
//   summary(ctx, from, to) -> [{label, value}] for weekly summary / reports
//   routes: [{ path, role, nav?, render(el, params, query, app) }]
//   coachSettings(app)   -> card on Coach → Einstellungen (saves on its own)
import strength from '../modules/strength/index.js';
import cardio from '../modules/cardio/index.js';
import pt from '../modules/pt/index.js';
import weight from '../modules/weight/index.js';
import nutrition from '../modules/nutrition/index.js';
import activity from '../modules/activity/index.js';
import sleep from '../modules/sleep/index.js';
import mood from '../modules/mood/index.js';
import watch from '../modules/watch/index.js';
import supplements from '../modules/supplements/index.js';
import cycle from '../modules/cycle/index.js';
import progress from '../modules/progress/index.js';
import hevy from '../modules/hevy/index.js';
import ai from '../modules/ai/index.js';
import parentReport from '../modules/parent-report/index.js';
import billing from '../modules/billing/index.js';
import achievements from '../modules/achievements/index.js';
import { FEATURES } from './config.js';

export const MODULES = [strength, cardio, pt, weight, nutrition, activity, sleep, mood, watch, supplements, cycle, progress, hevy, ai, parentReport, billing, achievements]
  .filter((m) => FEATURES[m.id] !== false)          // switched-off features are invisible everywhere
  .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));

/** Modules Max can switch on/off per client in the concept (data modules) */
export const SELECTABLE = MODULES.filter((m) => !m.always && !m.requires?.unlock).map((m) => [m.id, m.name]);

/** Premium unlocks */
export const UNLOCKS = [
  ['pt', 'Personal Training'],
  ['photos', 'Fotos & Umfänge'],
  ['hevy', 'Hevy-Anbindung'],
  ...(FEATURES.ai === false ? [] : [['ai', 'KI-Analyse']]),
  ['free_training', 'Freies Training']
];

export function getModule(id) { return MODULES.find((m) => m.id === id); }

/**
 * Is module m active for this client?
 * clientSettings: row from client_settings (for switches the client controls herself)
 */
export function isActive(m, client, clientSettings = client?._settings, role = 'client') {
  if (!client) return false;
  if (m.coachOnly && role !== 'coach') return false;
  if (m.always) return true;
  if (m.requires?.unlock) return (client.unlocks || []).includes(m.requires.unlock);
  if (!(client.modules || []).includes(m.id)) return false;
  if (m.requires?.consent && !client.extra_consents?.[m.requires.consent]) return false;
  if (m.requires?.clientSetting && clientSettings && clientSettings[m.requires.clientSetting] === false) return false;
  return true;
}

export function activeModules(client, role = 'client') {
  return MODULES.filter((m) => isActive(m, client, client?._settings, role));
}
