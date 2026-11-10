import type { AgWidgetField, AgWidgetParams } from 'ag-studio';
import { AgIncompleteDataMappingOverlay } from 'ag-studio-react';
import { use } from 'react';
import { formatValue } from '../money.js';
import type { KpiTileWidget } from '../types.js';
import styles from './KpiTile.module.css';
import { countLine, tileLayout } from './kpi.js';

type Params = AgWidgetParams<KpiTileWidget>;

/** One headline number, money formatted from cents, with an optional count line under it. */
export function KpiTileComp(params: Params) {
  const value = params.dataMapping.value?.at(0);
  if (!value) return <AgIncompleteDataMappingOverlay />;
  return <Tile params={params} value={value} />;
}

const VALUE_SIZE = {
  compact: styles.compact,
  regular: '',
  large: styles.large,
} as const;

function Tile({ params, value }: { params: Params; value: AgWidgetField }) {
  const { widgetApi, dataMapping, format } = params;
  const layout = tileLayout(format?.style);
  const count = layout.showCount ? dataMapping.count?.at(0) : undefined;
  const fields = count ? [value, count] : [value];

  const response = use(widgetApi.getData({ fields }));
  const row = response.results.rows[0] ?? {};
  const show = (field: AgWidgetField, raw: unknown) =>
    formatValue(field, raw, widgetApi.formatFieldValue);
  const detail = count
    ? countLine(row[count.key] ?? 0, show(count, row[count.key] ?? 0), {
        one: format?.style?.countOne,
        many: format?.style?.countMany,
      })
    : null;

  return (
    <div className={styles.tile}>
      <p className={`${styles.value} ${VALUE_SIZE[layout.valueSize] ?? ''}`.trim()}>
        {show(value, row[value.key])}
      </p>
      {detail ? <p className={styles.detail}>{detail}</p> : null}
    </div>
  );
}
