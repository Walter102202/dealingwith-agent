import type { AgWidgetField, AgWidgetParams } from 'ag-studio';
import { AgIncompleteDataMappingOverlay, AgNoDataOverlay } from 'ag-studio-react';
import { use } from 'react';
import { formatCents } from '../money.js';
import type { BudgetMeterWidget } from '../types.js';
import styles from './BudgetMeter.module.css';
import { budgetMeter, meterParts } from './budget.js';

type Params = AgWidgetParams<BudgetMeterWidget>;

/** Agent budget: what the client's agent has spent of its mandate, and what is left. */
export function BudgetMeterComp(params: Params) {
  const { dataMapping } = params;
  const spent = dataMapping.spent?.at(0);
  const limit = dataMapping.limit?.at(0);
  if (!spent || !limit) return <AgIncompleteDataMappingOverlay />;
  return <Meter params={params} spent={spent} limit={limit} />;
}

interface MeterProps {
  params: Params;
  spent: AgWidgetField;
  limit: AgWidgetField;
}

function Meter({ params, spent, limit }: MeterProps) {
  const { widgetApi, dataMapping, format } = params;
  const parts = meterParts(format?.style);
  const perPurchase = parts.perPurchase ? dataMapping.perPurchase?.at(0) : undefined;
  const expires = parts.expires ? dataMapping.expires?.at(0) : undefined;
  const status = parts.status ? dataMapping.status?.at(0) : undefined;
  const extras = [perPurchase, expires, status].filter((f): f is AgWidgetField => f != null);

  const response = use(widgetApi.getData({ fields: [spent, limit, ...extras] }));
  const row = response.results.rows[0];
  const meter = row ? budgetMeter(row[spent.key], row[limit.key]) : null;
  if (!row || !meter) return <AgNoDataOverlay />;

  const spentText = formatCents(meter.spentCents);
  const limitText = formatCents(meter.limitCents);
  const text = (field: AgWidgetField) => widgetApi.formatFieldValue(field, row[field.key]);

  return (
    <div className={styles.meter}>
      <p className={styles.left}>
        <span className={styles.amount}>{formatCents(meter.remainingCents)}</span>
        <span className={styles.leftLabel}>left</span>
      </p>
      {/* Decorative: the "Spent" fact below says the same in words. */}
      {parts.bar ? (
        <div className={styles.track} aria-hidden="true">
          <div
            className={`${styles.fill} ${meter.overLimit ? styles.over : ''}`}
            style={{ width: `${meter.spentPercent}%` }}
          />
        </div>
      ) : null}
      <dl className={styles.facts}>
        <div>
          <dt>Spent</dt>
          <dd>
            {spentText} of {limitText}
          </dd>
        </div>
        {perPurchase ? (
          <div>
            <dt>Per purchase</dt>
            <dd>{formatCents(row[perPurchase.key])}</dd>
          </div>
        ) : null}
        {status ? (
          <div>
            <dt>Status</dt>
            <dd className={styles.status}>{text(status)}</dd>
          </div>
        ) : null}
        {expires ? (
          <div>
            <dt>Expires</dt>
            <dd>{text(expires)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
