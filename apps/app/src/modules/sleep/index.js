// M6 Schlaf: duration + quality (watch or own estimate).
import { fmtNum } from '../../core/ui.js';
import { metricBlock, numField, ratingField } from '../../core/metric.js';
import { windowAvg } from '../../core/metrics.js';

export default {
  id: 'sleep',
  name: 'Schlaf',
  order: 40,
  icon: 'moon',
  color: 'indigo',
  description: 'Schlafdauer und -qualität',
  config: [
    { key: 'fields', label: 'Im Abend-Check abfragen', type: 'fields', store: 'config', default: ['sleep_h', 'sleep_quality'] },
    { key: 'sleep_h', label: 'Schlafziel', short: 'Ziel', type: 'number', store: 'target', unit: 'h', step: 0.5 }
  ],

  daily: [
    numField('sleep_h', 'Schlaf letzte Nacht', 'h', {
      decimal: true, step: '0.1', max: 24,
      plaus: (v, prev, t) => v > t.sleep_max_h ? `${fmtNum(v, 1)} h Schlaf – Tippfehler?` : null
    }),
    ratingField('sleep_quality', 'Schlafqualität', ['sehr schlecht', 'schlecht', 'okay', 'gut', 'sehr gut'])
  ],

  async analysis(ctx) {
    const t = ctx.client.targets || {};
    const frag = document.createDocumentFragment();
    frag.append(
      metricBlock(ctx, { key: 'sleep_h', label: 'Schlafdauer', unit: 'h', digits: 1, roll: true, target: t.sleep_h ?? null }),
      metricBlock(ctx, { key: 'sleep_quality', label: 'Schlafqualität (1–5)', digits: 1, roll: true })
    );
    return frag;
  },

  summary(ctx, from, to) {
    const s = windowAvg(ctx.daily, 'sleep_h', from, to);
    const q = windowAvg(ctx.daily, 'sleep_quality', from, to);
    return [{ label: 'Schlaf Ø', value: s.avg != null ? `${fmtNum(s.avg, 1)} h, Qualität ${fmtNum(q.avg, 1)}/5` : '–' }];
  }
};
