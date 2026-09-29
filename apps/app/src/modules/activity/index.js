// M5 Aktivität: steps + active kcal, read off watch/phone in the evening.
import { fmtNum } from '../../core/ui.js';
import { metricBlock, numField } from '../../core/metric.js';
import { windowAvg, coverageText } from '../../core/metrics.js';

export default {
  id: 'activity',
  name: 'Aktivität',
  order: 30,
  icon: 'steps',
  color: 'ok',
  description: 'Schritte und aktive Kalorien von Uhr oder Handy',
  config: [
    { key: 'fields', label: 'Im Abend-Check abfragen', type: 'fields', store: 'config', default: ['steps', 'active_kcal'] },
    { key: 'steps', label: 'Schrittziel pro Tag', short: 'Ziel', type: 'number', store: 'target', unit: 'Schritte', step: 500 }
  ],

  daily: [
    numField('steps', 'Schritte', '', {
      max: 200000,
      plaus: (v, prev, t) => v > t.steps_max ? `${fmtNum(v)} Schritte – Tippfehler?` : null
    }),
    numField('active_kcal', 'Verbrannte kcal (aktiv)', 'kcal', { max: 10000 })
  ],

  async analysis(ctx) {
    const t = ctx.client.targets || {};
    const frag = document.createDocumentFragment();
    frag.append(
      metricBlock(ctx, { key: 'steps', label: 'Schritte', type: 'bar', zero: true, target: t.steps ?? null }),
      metricBlock(ctx, { key: 'active_kcal', label: 'Aktive kcal', unit: 'kcal', type: 'bar', zero: true })
    );
    return frag;
  },

  summary(ctx, from, to) {
    const s = windowAvg(ctx.daily, 'steps', from, to);
    return [{ label: 'Schritte Ø', value: s.avg != null ? `${fmtNum(s.avg)} (${coverageText(s.n, s.of)})` : '–' }];
  }
};
