// Goals = presets for which modules are active and how progress is rated.

export const GOALS = {
  bulk: {
    label: 'Muskelaufbau (Bulk)',
    modules: ['strength', 'nutrition', 'weight', 'sleep', 'mood'],
    optional: ['cardio', 'activity', 'supplements'],
    weekly: { min: 0.1, max: 0.5 }      // kg per week, default green band
  },
  cut: {
    label: 'Fettabbau (Cut)',
    modules: ['strength', 'cardio', 'nutrition', 'weight', 'activity', 'sleep', 'mood'],
    optional: ['supplements'],
    weekly: { min: -1.0, max: -0.2 }
  },
  endurance: {
    label: 'Laufen/Ausdauer',
    modules: ['cardio', 'activity', 'sleep', 'mood'],
    optional: ['strength', 'nutrition', 'weight', 'watch'],
    weekly: null
  },
  fitness: {
    label: 'Allgemeine Fitness',
    modules: ['strength', 'cardio', 'activity', 'sleep', 'mood'],
    optional: ['nutrition', 'weight'],
    weekly: null
  },
  recomp: {
    label: 'Recomp/Halten',
    modules: ['strength', 'nutrition', 'weight', 'activity', 'sleep', 'mood'],
    optional: ['cardio', 'supplements'],
    weekly: { min: -0.2, max: 0.2 }
  }
};

export const GOAL_OPTIONS = Object.entries(GOALS).map(([k, g]) => [k, g.label]);

export const STATUS = {
  lead: { label: 'Interessent · offen', group: 'lead' },
  concept: { label: 'Interessent · Konzept', group: 'lead' },
  active: { label: 'Aktiv', group: 'client' },
  maintenance: { label: 'Erhaltung', group: 'client' },
  reduced: { label: 'Reduziert', group: 'client' },
  paused_sick: { label: 'Pause · Krankheit/Verletzung', group: 'client' },
  paused_other: { label: 'Pause · Urlaub/Sonstiges', group: 'client' },
  ended: { label: 'Beendet', group: 'ended' },
  discarded: { label: 'Verworfen', group: 'discarded' }
};

export const isPaused = (status) => status === 'paused_sick' || status === 'paused_other';

export const PAUSE_REASONS = [
  ['illness', 'Krankheit'],
  ['accident', 'Unfall'],
  ['injury', 'Verletzung'],
  ['mental', 'Psychische Belastung'],
  ['vacation', 'Urlaub'],
  ['other', 'Sonstiges']
];

export const PAUSE_DETAILS = {
  illness: ['Erkältung/Infekt', 'Magen-Darm', 'Fieber', 'Sonstiges'],
  injury: ['Muskel (Zerrung/Faserriss)', 'Gelenk/Bänder', 'Knochen (Bruch)', 'Sehne', 'Rücken', 'Sonstiges'],
  accident: ['Muskel (Zerrung/Faserriss)', 'Gelenk/Bänder', 'Knochen (Bruch)', 'Sehne', 'Rücken', 'Sonstiges']
};

/**
 * Green band for weekly weight change (kg/week) given goal, status and coach targets.
 * Returns null when weight change is not rated for this goal.
 */
export function weeklyBand(client) {
  if (client.status === 'maintenance') return { min: -0.2, max: 0.2 };
  const t = client.targets || {};
  if (t.weekly_change_min != null || t.weekly_change_max != null) {
    return { min: t.weekly_change_min ?? null, max: t.weekly_change_max ?? null };
  }
  if (t.weekly_change_kg != null) {
    const v = Number(t.weekly_change_kg);
    return v >= 0 ? { min: v * 0.5, max: v * 1.6 + 0.05 } : { min: v * 1.6 - 0.05, max: v * 0.5 };
  }
  return GOALS[client.goal]?.weekly || null;
}

export function rateWeekly(client, change) {
  const band = weeklyBand(client);
  if (!band || change == null) return null;
  if ((band.min == null || change >= band.min) && (band.max == null || change <= band.max)) return 'ok';
  return 'warn';
}
