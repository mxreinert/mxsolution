// M4 Körpergewicht
import { h, fmtNum, fmtSigned, card, fcard } from '../../core/ui.js';
import { moduleConfig } from '../../core/modcfg.js';
import { chart } from '../../core/chart.js';
import { kpi, kpiRow, numField } from '../../core/metric.js';
import { points, rolling, weeklyChange, windowAvg, coverageText } from '../../core/metrics.js';
import { weeklyBand, rateWeekly } from '../../core/goals.js';
import { addDays, today } from '../../core/dates.js';

export default {
  id: 'weight',
  name: 'Körpergewicht',
  order: 10,
  icon: 'scale',
  color: 'teal',
  description: 'Tägliches Gewicht mit 7-Tage-Schnitt und Wochenziel',
  config: [
    { key: 'weekly_change_kg', label: 'Ziel-Veränderung pro Woche', short: 'Ziel', type: 'number', store: 'target', unit: 'kg/Woche', step: 0.05, hint: 'z. B. 0,25 (Aufbau) oder −0,5 (Diät)' },
    { key: 'morning_prompt', label: 'Morgens ans Wiegen erinnern (Heute-Karte)', type: 'toggle', store: 'config', default: true }
  ],

  daily: [
    numField('weight_kg', 'Körpergewicht', 'kg', {
      decimal: true, step: '0.1', min: 20, max: 400,
      hint: 'Am besten morgens nüchtern',
      plaus: (v, prev, t) => prev != null && Math.abs(v - prev) > t.weight_delta_kg
        ? `${fmtSigned(v - prev)} kg zum letzten Eintrag – Tippfehler?` : null
    })
  ],

  async today(ctx) {
    if (!moduleConfig(this, ctx.client, ctx.settings).morning_prompt) return null;
    const todays = ctx.daily.find((r) => r.day === today());
    if (todays?.weight_kg != null || new Date().getHours() >= 12) return null;
    return fcard({ icon: 'scale', color: 'teal', title: 'Morgen-Check', sub: 'Nüchtern wiegen und Schlaf eintragen – 30 Sekunden', href: '#/eintragen?teil=morgen', cls: 'hl' });
  },

  async analysis(ctx) {
    const pts = points(ctx.daily, 'weight_kg');
    const avg = rolling(pts, 7);
    const change = weeklyChange(pts, today());
    const rating = rateWeekly(ctx.client, change);
    const band = weeklyBand(ctx.client);
    const a7 = windowAvg(ctx.daily, 'weight_kg', addDays(today(), -6), today());
    const hints = (ctx.hints || []).filter((x) => x.for === 'weight');

    return card('Körpergewicht',
      kpiRow(
        kpi('Ø 7 Tage', fmtNum(a7.avg, 1), { unit: 'kg', sub: coverageText(a7.n, a7.of) }),
        kpi('Veränderung/Woche', fmtSigned(change, 2), {
          unit: 'kg', cls: rating || '',
          sub: band ? `Ziel ${band.min != null ? fmtSigned(band.min, 2) : '…'} bis ${band.max != null ? fmtSigned(band.max, 2) : '…'}` : ''
        })
      ),
      chart({
        from: ctx.from, to: ctx.to, unit: 'kg',
        series: [
          { label: 'Tageswert', points: pts, type: 'dots', cls: 'muted', digits: 1 },
          { label: 'Ø 7 Tage', points: avg, cls: 'accent', digits: 1, dots: false }
        ],
        bands: ctx.bands, markers: ctx.markers || []
      }),
      hints.map((x) => h('p', { class: 'hint' }, '', x.text)),
      h('p', { class: 'hint muted' }, 'Der 7-Tage-Schnitt zählt, nicht der Einzelwert. Schwankungen von 1–2 kg am Tag sind normal.')
    );
  },

  summary(ctx, from, to) {
    const pts = points(ctx.daily, 'weight_kg');
    const a = windowAvg(ctx.daily, 'weight_kg', from, to);
    const change = weeklyChange(pts, to);
    return [
      { label: 'Gewicht Ø', value: a.avg != null ? `${fmtNum(a.avg, 1)} kg (${coverageText(a.n, a.of)})` : '–' },
      { label: 'Veränderung', value: change != null ? `${fmtSigned(change, 2)} kg/Woche` : '–' }
    ];
  }
};
