// Module settings. Each module declares its options in `config`:
//   { key, label, type: 'number'|'toggle'|'fields'|'select', store: 'target'|'config', default, unit, step, options, hint }
// Storage (no extra table, RLS unchanged):
//   store 'target' -> clients.targets[key]              (e.g. kcal, steps – read everywhere as targets)
//   store 'config' -> clients.targets.config[module][key] (e.g. which evening fields are asked)
// Coach-wide defaults: coach_settings.settings.module_defaults[module][key]
// Goal presets:       coach_settings.settings.goal_presets[goal] = [module ids]
import { GOALS } from './goals.js';

const num = (v, step) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: String(step || 1).includes('.') ? 2 : 0 }).format(Number(v));

/** Effective option values for a module and client */
export function moduleConfig(m, client, settings) {
  const out = {};
  const defaults = settings?.module_defaults?.[m.id] || {};
  const own = client?.targets?.config?.[m.id] || {};
  for (const c of m.config || []) {
    const fromClient = c.store === 'target' ? client?.targets?.[c.key] : own[c.key];
    out[c.key] = fromClient !== undefined && fromClient !== null ? fromClient
      : defaults[c.key] !== undefined ? defaults[c.key]
        : c.default;
  }
  return out;
}

/** Evening-check fields of a module after the "fields" option is applied */
export function activeFields(m, client, settings) {
  const cfg = moduleConfig(m, client, settings);
  const fieldsOpt = (m.config || []).find((c) => c.type === 'fields');
  if (!fieldsOpt || !Array.isArray(cfg[fieldsOpt.key])) return m.daily || [];
  return (m.daily || []).filter((f) => cfg[fieldsOpt.key].includes(f.key));
}

/** Modules switched on by default for a goal (coach presets override the built-in ones) */
export function goalModules(goal, settings) {
  return settings?.goal_presets?.[goal] || GOALS[goal]?.modules || [];
}

/** Write one option into a targets object (returns a new targets object) */
export function setOption(targets, m, c, value) {
  const t = structuredClone(targets || {});
  if (c.store === 'target') {
    if (value === null || value === undefined || value === '') delete t[c.key];
    else t[c.key] = value;
  } else {
    t.config = t.config || {};
    t.config[m.id] = { ...(t.config[m.id] || {}), [c.key]: value };
  }
  return t;
}

/** Short human summary of a module's settings for list rows */
export function configSummary(m, client, settings) {
  const cfg = moduleConfig(m, client, settings);
  const parts = [];
  for (const c of m.config || []) {
    const v = cfg[c.key];
    if (c.type === 'number' && v != null && v !== '') {
      const label = c.short && c.short !== c.unit ? c.short + ' ' : '';
      parts.push(`${label}${num(v, c.step)}${c.unit ? ' ' + c.unit : ''}`);
    }
    if (c.type === 'fields' && Array.isArray(v) && m.daily && v.length < m.daily.length) parts.push(`${v.length}/${m.daily.length} Felder`);
  }
  return parts.join(' · ');
}
