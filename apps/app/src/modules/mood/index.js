// M7 Motivation & Befinden
import { fmtNum } from '../../core/ui.js';
import { metricBlock, ratingField } from '../../core/metric.js';
import { windowAvg } from '../../core/metrics.js';

export default {
  id: 'mood',
  name: 'Motivation & Befinden',
  order: 50,

  daily: [
    ratingField('motivation', 'Motivation', ['sehr niedrig', 'niedrig', 'mittel', 'hoch', 'sehr hoch']),
    ratingField('energy', 'Energie', ['sehr niedrig', 'niedrig', 'mittel', 'hoch', 'sehr hoch'])
  ],

  async analysis(ctx) {
    const frag = document.createDocumentFragment();
    frag.append(
      metricBlock(ctx, { key: 'motivation', label: 'Motivation (1–5)', digits: 1, roll: true }),
      metricBlock(ctx, { key: 'energy', label: 'Energie (1–5)', digits: 1, roll: true })
    );
    return frag;
  },

  summary(ctx, from, to) {
    const m = windowAvg(ctx.daily, 'motivation', from, to);
    const e = windowAvg(ctx.daily, 'energy', from, to);
    return [{ label: 'Motivation/Energie Ø', value: m.avg != null ? `${fmtNum(m.avg, 1)} / ${fmtNum(e.avg, 1)}` : '–' }];
  }
};
