// M3 Ernährung: kcal + macros, copied from Yazio/MyFitnessPal. No food database on purpose.
import { h, fmtNum, card } from '../../core/ui.js';
import { chart, meter } from '../../core/chart.js';
import { kpi, kpiRow, numField } from '../../core/metric.js';
import { points, windowAvg, coverageText, has } from '../../core/metrics.js';
import { addDays, today, range } from '../../core/dates.js';

const pct = (a, b) => (has(a) && b ? a / b : null);

export default {
  id: 'nutrition',
  name: 'Ernährung',
  order: 20,

  daily: [
    numField('kcal', 'Kalorien', 'kcal', {
      max: 20000,
      plaus: (v, prev, t) => v < t.kcal_min || v > t.kcal_max ? `${fmtNum(v)} kcal – bitte prüfen` : null
    }),
    numField('protein_g', 'Protein', 'g', { max: 1000 }),
    numField('carbs_g', 'Kohlenhydrate', 'g', { max: 2000 }),
    numField('fat_g', 'Fett', 'g', { max: 1000 })
  ],
  trackGroup: ['kcal', 'protein_g', 'carbs_g', 'fat_g'], // one "Nicht getrackt" button for all

  async analysis(ctx) {
    const t = ctx.client.targets || {};
    const a7 = (k) => windowAvg(ctx.daily, k, addDays(today(), -6), today());
    const kcal = a7('kcal'), prot = a7('protein_g');

    // protein hit rate: days with protein >= 90 % of target
    const days = range(ctx.from, ctx.to);
    const protDays = ctx.daily.filter((r) => r.day >= ctx.from && has(r.protein_g));
    const hits = t.protein_g ? protDays.filter((r) => r.protein_g >= t.protein_g * 0.9).length : null;

    const macroRow = (label, key, target) => {
      const a = a7(key);
      return h('div', { class: 'macro' },
        h('div', { class: 'macro-head' }, h('span', null, label),
          h('span', { class: 'muted' }, `${fmtNum(a.avg)} / ${target ? fmtNum(target) : '–'} g`)),
        target ? meter(pct(a.avg, target), a.avg >= target * 0.9 && a.avg <= target * 1.1 ? 'ok' : 'accent') : null);
    };

    return card('Ernährung',
      kpiRow(
        kpi('Ø kcal 7 Tage', fmtNum(kcal.avg), { sub: coverageText(kcal.n, kcal.of) }),
        kpi('Ziel', t.kcal ? fmtNum(t.kcal) : '–', { unit: 'kcal', sub: t.kcal_rest ? `Ruhetag ${fmtNum(t.kcal_rest)}` : '' }),
        kpi('Protein-Treffer', hits != null && protDays.length ? `${hits}/${protDays.length}` : '–', { sub: 'Tage ≥ 90 % Ziel' })
      ),
      chart({
        from: ctx.from, to: ctx.to, unit: 'kcal', zero: true,
        series: [{ label: 'kcal', points: points(ctx.daily, 'kcal'), type: 'bar', cls: 'accent', digits: 0 }],
        band: t.kcal ? { min: t.kcal * 0.95, max: t.kcal * 1.05 } : null,
        bands: ctx.bands
      }),
      macroRow('Protein', 'protein_g', t.protein_g),
      macroRow('Kohlenhydrate', 'carbs_g', t.carbs_g),
      macroRow('Fett', 'fat_g', t.fat_g),
      days.length > 7 ? chart({
        from: ctx.from, to: ctx.to, unit: 'g',
        series: [
          { label: 'Protein', points: points(ctx.daily, 'protein_g'), cls: 'accent', digits: 0 },
          { label: 'KH', points: points(ctx.daily, 'carbs_g'), cls: 'muted', digits: 0 },
          { label: 'Fett', points: points(ctx.daily, 'fat_g'), cls: 'warn', digits: 0 }
        ],
        bands: ctx.bands
      }) : null
    );
  },

  summary(ctx, from, to) {
    const a = windowAvg(ctx.daily, 'kcal', from, to);
    const p = windowAvg(ctx.daily, 'protein_g', from, to);
    return [
      { label: 'kcal Ø', value: a.avg != null ? `${fmtNum(a.avg)} (${coverageText(a.n, a.of)})` : '–' },
      { label: 'Protein Ø', value: p.avg != null ? `${fmtNum(p.avg)} g` : '–' }
    ];
  }
};
