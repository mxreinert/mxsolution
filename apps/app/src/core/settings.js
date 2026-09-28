// Defaults for everything Max can change in the dashboard settings (no code, no deploy).

export const DEFAULT_SETTINGS = {
  whatsapp: '',
  cancel_hours: 24,
  thresholds: {
    weight_delta_kg: 3,      // warn if weight differs more than this from the previous entry
    kcal_min: 800,
    kcal_max: 6000,
    steps_max: 50000,
    sleep_max_h: 14,
    set_jump_pct: 40,        // warn if a set weight differs > 40 % from last time
    ampel_yellow_days: 2,    // no entries for 2–3 days -> yellow
    ampel_red_days: 4,
    mood_low_value: 2,       // motivation <= 2 ...
    mood_low_days: 3         // ... on 3 days in a row -> red
  },
  reminders: {
    weigh: { on: true, time: '07:00', label: 'Morgens wiegen' },
    evening: { on: true, time: '20:30', label: 'Abend-Check' },
    training: { on: true, time: '16:00', label: 'Trainingstag' },
    checkin: { on: true, time: '18:00', label: 'Check-in abgeben' }
  },
  privacy_text:
    'Deine Daten (Einträge, Training, Check-ins, Nutzungszeiten der App) sehen nur du und Max. ' +
    'Sie liegen auf Servern in der EU (Supabase, Frankfurt). Du kannst jederzeit Auskunft, Export oder Löschung über Max anfordern.',
  help_text: '',
  faq: [
    { q: 'Wie füge ich die App zum Homescreen hinzu?', a: 'iPhone: In Safari auf „Teilen“ tippen → „Zum Home-Bildschirm“. Android: In Chrome Menü (⋮) → „App installieren“ oder „Zum Startbildschirm hinzufügen“.' },
    { q: 'Wie aktiviere ich Push-Benachrichtigungen?', a: 'Im Profil unter „Benachrichtigungen“. Auf dem iPhone geht das nur, wenn die App zum Homescreen hinzugefügt wurde (iOS 16.4 oder neuer).' },
    { q: 'Was ist der Abend-Check?', a: 'Einmal am Abend trägst du die Werte des Tages ein, dauert unter 2 Minuten. Leere Felder sind okay – lieber unvollständig als gar nicht.' },
    { q: 'Warum schwankt mein Gewicht?', a: 'Wasser, Salz, Kohlenhydrate, Verdauung, Zyklus und Kreatin verändern das Gewicht täglich um 1–2 kg. Deshalb zählt der 7-Tage-Schnitt, nicht der Einzelwert.' },
    { q: 'Was ist RIR?', a: '„Reps in Reserve“: wie viele Wiederholungen du noch geschafft hättest. RIR 2 = noch 2 saubere Wiederholungen möglich.' }
  ]
};

export function mergeSettings(stored) {
  const s = stored || {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    thresholds: { ...DEFAULT_SETTINGS.thresholds, ...(s.thresholds || {}) },
    reminders: { ...DEFAULT_SETTINGS.reminders, ...(s.reminders || {}) },
    faq: Array.isArray(s.faq) && s.faq.length ? s.faq : DEFAULT_SETTINGS.faq
  };
}
