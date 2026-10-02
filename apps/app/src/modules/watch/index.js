// M8 Gesundheitswerte Uhr (optional): resting heart rate, HRV
import { metricBlock, numField } from '../../core/metric.js';

export default {
  id: 'watch',
  name: 'Uhr-Werte',
  order: 60,
  icon: 'heart',
  color: 'bad',
  description: 'Ruhepuls und HRV von der Uhr',
  config: [
    { key: 'fields', label: 'Im Morgen-Check abfragen', type: 'fields', store: 'config', default: ['resting_hr', 'hrv_ms'] }
  ],

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
