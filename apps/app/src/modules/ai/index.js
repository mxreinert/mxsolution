// M10 KI-Analyse (unlock "ai", coach only for now – Max reviews and passes it on in his own words).
// Only numbers are sent, never name or username. Requires documented consent (extra_consents.ai).
import { h, card, empty, input, field, toast, showError, confirmDialog, clear } from '../../core/ui.js';
import { q, from, api } from '../../core/db.js';
import { today, addDays, fmtDateTime, fmt } from '../../core/dates.js';

function renderText(text) {
  // simple markdown-ish rendering: **bold** headings and "- " bullets, all via textContent
  return h('div', { class: 'ai-text' }, text.split('\n').filter((l) => l.trim()).map((line) => {
    const bold = line.match(/^\*\*(.+?)\*\*\s*[—–-]?\s*(.*)$/);
    if (bold) return h('p', null, h('strong', null, bold[1]), bold[2] ? ' ' + bold[2] : '');
    if (/^[-•]\s/.test(line)) return h('p', { class: 'bullet' }, '• ', line.replace(/^[-•]\s/, ''));
    return h('p', null, line);
  }));
}

export default {
  id: 'ai',
  name: 'KI-Analyse',
  order: 96,
  icon: 'sparkles',
  color: 'purple',
  description: 'KI-Auswertung der Daten – nur für dich',
  coachOnly: true,
  requires: { unlock: 'ai' },

  async coach(ctx) {
    const consent = ctx.client.extra_consents?.ai;
    const past = await q(from('ai_analyses').select('*').eq('client_id', ctx.client.id).order('created_at', { ascending: false }).limit(10));
    const fromIn = input({ type: 'date', value: addDays(today(), -27) });
    const toIn = input({ type: 'date', value: today() });
    const question = input({ maxlength: 300, placeholder: 'Optionale Frage, z. B. „Stagniert das Bankdrücken?“' });
    const out = h('div');

    const wrap = card('KI-Analyse',
      !consent ? h('p', { class: 'warn-text' }, 'Keine dokumentierte Einwilligung zur KI-Übertragung (USA). Im Konzept unter „Einwilligungen“ eintragen.') : null,
      h('p', { class: 'muted small' }, 'Gesendet werden nur Zahlen (Tageswerte, Trainingsvolumen, Ziel). Kein Name, kein Benutzername. Kostet pro Analyse – Tageslimit auf dem Server.'),
      h('div', { class: 'grid2' }, field('Von', fromIn), field('Bis', toIn)),
      field('Frage', question),
      h('button', {
        type: 'button', disabled: !consent, onclick: async (e) => {
          e.target.disabled = true;
          clear(out).append(h('p', { class: 'muted' }, 'Analyse läuft … (kann bis zu einer Minute dauern)'));
          try {
            const r = await api('ai', { clientId: ctx.client.id, from: fromIn.value, to: toIn.value, question: question.value.trim() });
            clear(out).append(card(`Analyse ${fmt(fromIn.value)} – ${fmt(toIn.value)}`, renderText(r.result)));
          } catch (err) { clear(out); showError(err); }
          e.target.disabled = false;
        }
      }, 'Analyse erstellen'),
      out);

    const hist = card('Frühere Analysen',
      past.length ? past.map((a) => h('details', null,
        h('summary', null, `${fmtDateTime(a.created_at)} · ${fmt(a.period_from)}–${fmt(a.period_to)}`),
        renderText(a.result),
        h('button', {
          type: 'button', class: 'link-btn danger', onclick: async () => {
            if (!await confirmDialog('Analyse löschen?', { ok: 'Löschen', danger: true })) return;
            try { await q(from('ai_analyses').delete().eq('id', a.id)); ctx.refresh(); } catch (e) { showError(e); }
          }
        }, 'Löschen'))) : empty('Noch keine.'));
    const frag = document.createDocumentFragment();
    frag.append(wrap, hist);
    return frag;
  }
};
