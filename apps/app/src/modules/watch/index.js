// M8 Gesundheitswerte Uhr (optional): resting heart rate, HRV
import { metricBlock, numField } from '../../core/metric.js';

export default {
  id: 'watch',
  name: 'Uhr-Werte',
  order: 60,

  daily: [
    numField('resting_hr', 'Ruhepuls', 'bpm', { min: 20, max: 250 }),
    numField('hrv_ms', 'HRV', 'ms', { min: 1, max: 500 })
  ],

  async analysis(ctx) {
    const frag = document.createDocumentFragment();
    frag.append(
      metricBlock(ctx, { key: 'resting_hr', label: 'Ruhepuls', unit: 'bpm', roll: true }),
      metricBlock(ctx, { key: 'hrv_ms', label: 'HRV', unit: 'ms', roll: true })
    );
    return frag;
  }
};
