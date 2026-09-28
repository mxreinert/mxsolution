// First day: privacy notice -> max 3 intro screens -> devices -> push -> start values -> Heute.
import { h, clear, select, input, field, toast, showError, parseNum } from '../core/ui.js';
import { q, from } from '../core/db.js';
import { GOALS } from '../core/goals.js';
import { today } from '../core/dates.js';
import { pushState, enablePush } from '../core/push.js';
import { reloadOwnClient } from '../core/app.js';

export async function renderOnboarding(el, app) {
  const c = app.client;
  const mods = app.modules.filter((m) => app.isActive(m, c) && !m.coachOnly);
  const s = c._settings || {};
  let step = s.privacy_ack_at ? 1 : 0;
  const box = h('div', { class: 'onboarding' });
  el.append(box);

  const save = (patch) => q(from('client_settings').upsert({ client_id: c.id, ...patch }, { onConflict: 'client_id' }));
  const next = () => { step += 1; draw(); };
  const dots = () => h('div', { class: 'steps', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4, 5].map((i) => h('span', { class: i === step ? 'on' : '' })));

  const draw = async () => {
    clear(box).append(dots());
    if (step === 0) {
      box.append(h('h1', null, 'Willkommen, ', c.first_name, '!'),
        h('h2', null, 'Kurz zum Datenschutz'),
        h('p', { class: 'prewrap' }, app.settings.privacy_text),
        h('p', { class: 'muted small' }, 'Außerdem speichert die App, wann du sie öffnest, damit Max sieht, ob alles klappt.'),
        h('button', { type: 'button', onclick: async () => { try { await save({ privacy_ack_at: new Date().toISOString() }); next(); } catch (e) { showError(e); } } }, 'Verstanden'));
    } else if (step === 1) {
      box.append(h('h1', null, '🎯 Dein Ziel'), h('p', { class: 'lead' }, GOALS[c.goal]?.label || 'Max legt dein Ziel gerade fest.'),
        c.milestones ? h('p', { class: 'prewrap muted' }, c.milestones) : null,
        h('button', { type: 'button', onclick: next }, 'Weiter'));
    } else if (step === 2) {
      box.append(h('h1', null, '🧩 Deine Bereiche'), h('p', null, 'Das trackst du in der App:'),
        h('ul', { class: 'module-list' }, mods.map((m) => h('li', null, m.name))),
        h('p', { class: 'muted small' }, 'Die App liest nichts automatisch aus Uhr oder Apps – du trägst die Werte selbst ein.'),
        h('button', { type: 'button', onclick: next }, 'Weiter'));
    } else if (step === 3) {
      const watch = select([['', '– keine –'], ['apple', 'Apple Watch'], ['garmin', 'Garmin'], ['fitbit', 'Fitbit'], ['samsung', 'Samsung'], ['phone', 'nur Handy'], ['other', 'andere']], '');
      const food = select([['', '– keine –'], ['yazio', 'Yazio'], ['mfp', 'MyFitnessPal'], ['fddb', 'FDDB'], ['other', 'andere']], '');
      box.append(h('h1', null, '✍️ So funktioniert der Abend-Check'),
        h('p', null, 'Einmal am Abend trägst du die Werte des Tages ein. Dauert unter 2 Minuten. Leere Felder sind okay.'),
        field('Welche Uhr nutzt du?', watch), field('Welche Ernährungs-App?', food),
        h('button', { type: 'button', onclick: async () => { try { await save({ devices: { watch: watch.value || null, nutrition_app: food.value || null } }); next(); } catch (e) { showError(e); } } }, 'Weiter'));
    } else if (step === 4) {
      const st = await pushState();
      box.append(h('h1', null, '🔔 Erinnerungen'),
        h('p', null, 'Damit du den Abend-Check nicht vergisst und Feedback von Max sofort siehst.'),
        st === 'needs-homescreen' ? h('p', { class: 'hint' }, 'iPhone: Füge die App zuerst zum Homescreen hinzu (Teilen → „Zum Home-Bildschirm“), öffne sie von dort und aktiviere Push dann im Profil.') : null,
        st === 'off' ? h('button', { type: 'button', onclick: async () => { try { await enablePush(); toast('Push aktiviert'); } catch (e) { showError(e); } next(); } }, 'Push erlauben') : null,
        h('button', { type: 'button', class: 'secondary', onclick: next }, st === 'off' ? 'Später' : 'Weiter'));
    } else {
      const weightOn = mods.some((m) => m.id === 'weight');
      const w = input({ type: 'number', step: '0.1', inputmode: 'decimal', placeholder: 'kg' });
      box.append(h('h1', null, '🚀 Startwerte'),
        weightOn ? field('Aktuelles Körpergewicht (morgens nüchtern)', w) : h('p', null, 'Alles bereit!'),
        h('button', {
          type: 'button', onclick: async () => {
            try {
              const kg = parseNum(w.value);
              if (weightOn && kg) await q(from('daily_entries').upsert({ client_id: c.id, day: today(), weight_kg: kg }, { onConflict: 'client_id,day' }));
              await save({ onboarded_at: new Date().toISOString() });
              await reloadOwnClient();
              location.hash = '#/heute';
              location.reload();
            } catch (e) { showError(e); }
          }
        }, 'Los geht’s'));
    }
  };
  await draw();
}
