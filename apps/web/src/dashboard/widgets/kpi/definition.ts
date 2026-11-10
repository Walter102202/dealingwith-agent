import type { KpiTileDefinition } from '../types.js';
import { KpiTileComp } from './KpiTile.js';

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="12" height="10" rx="2"/><path d="M5 9.5h3M5 6.5h6"/></svg>';

/**
 * "KPI tile": one headline value with a count line under it. Chosen over the
 * stock `value` widget because money stays in integer cents and is shown with
 * `formatUsd`, and the count line ("2 quotes waiting") follows the data.
 */
export const kpiTileDefinition: KpiTileDefinition = {
  id: 'kpi-tile',
  label: 'KPI tile',
  icon: ICON,
  dataMapping: {
    value: {
      type: 'field',
      supportedRoles: ['numeric'],
      requires: { cardinality: 'one' },
      required: true,
      aiDescription: 'The headline value. Cents fields are shown as US$.',
    },
    count: {
      type: 'field',
      supportedRoles: ['numeric'],
      requires: { cardinality: 'one' },
      aiDescription: 'Optional count shown under the value, e.g. a distinct count of quotes.',
    },
  },
  form: (params) => {
    const form = params.createDefaults({
      dataMappingItems: [
        { key: 'value', label: 'Value' },
        { key: 'count', label: 'Count' },
      ],
      supportsCrossHighlight: false,
    });
    form.items[1]?.items.push(
      { type: 'textfield', id: 'format.style.countOne', label: 'Count words (one)' },
      { type: 'textfield', id: 'format.style.countMany', label: 'Count words (many)' },
    );
    return form;
  },
  comp: KpiTileComp,
  defaultSize: { width: 300, height: 140 },
  minSize: { width: 180, height: 110 },
  ai: {
    description: 'A single headline number with an optional count line underneath.',
    usage: 'Use for totals such as unpaid additionals or money collected.',
  },
};
