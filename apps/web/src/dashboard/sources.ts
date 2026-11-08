import type {
  DashboardData,
  DashboardLineRow,
  DashboardPaymentRow,
  DashboardQuoteRow,
  DashboardRequestRow,
} from '@dealingwith/contracts';
import type { AgFieldDefinition } from 'ag-studio';

/**
 * AG Studio takes arrays of flat plain objects per source. Each row keeps its
 * cents fields and gains `…Usd` columns for charting only (display, not
 * pricing) plus a `day` column so time series group cleanly.
 *
 * Fields are declared explicitly rather than inferred from the rows: right
 * after "Reset demo data" every source is empty, and an inferred schema would
 * have no fields, so the saved dashboard definition would fail validation.
 */

type Row = Record<string, string | number | boolean | null>;

export interface StudioSource<T extends Row = Row> {
  id: 'quotes' | 'lines' | 'payments' | 'requests';
  name: string;
  data: T[];
  fields: AgFieldDefinition[];
}

export interface StudioSources {
  sources: [
    StudioSource<QuoteRow>,
    StudioSource<LineRow>,
    StudioSource<PaymentRow>,
    StudioSource<RequestRow>,
  ];
}

export type QuoteRow = DashboardQuoteRow & { totalUsd: number; day: string };
export type LineRow = DashboardLineRow & { amountUsd: number; day: string };
export type PaymentRow = DashboardPaymentRow & { amountUsd: number; day: string };
export type RequestRow = DashboardRequestRow & { day: string };

type Format = 'textFormat' | 'integerFormat' | 'decimalFormat' | 'dateFormat' | 'dateTimeFormat';

/** "quoteStatus" → "Quote status". */
const humanize = (id: string) => {
  const spaced = id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const fields = <T extends Row>(spec: Record<keyof T & string, Format>): AgFieldDefinition[] =>
  Object.entries(spec).map(([id, format]) => ({ id, name: humanize(id), format }));

const QUOTE_FIELDS = fields<QuoteRow>({
  quoteId: 'textFormat',
  version: 'integerFormat',
  status: 'textFormat',
  channel: 'textFormat',
  requestText: 'textFormat',
  clientName: 'textFormat',
  projectTitle: 'textFormat',
  includedLines: 'integerFormat',
  extraLines: 'integerFormat',
  totalCents: 'integerFormat',
  totalUsd: 'decimalFormat',
  createdAt: 'dateTimeFormat',
  paidAt: 'dateTimeFormat',
  day: 'dateFormat',
});

const LINE_FIELDS = fields<LineRow>({
  quoteId: 'textFormat',
  version: 'integerFormat',
  quoteStatus: 'textFormat',
  kind: 'textFormat',
  label: 'textFormat',
  ruleId: 'textFormat',
  serviceName: 'textFormat',
  amountCents: 'integerFormat',
  amountUsd: 'decimalFormat',
  clientName: 'textFormat',
  projectTitle: 'textFormat',
  channel: 'textFormat',
  createdAt: 'dateTimeFormat',
  paidAt: 'dateTimeFormat',
  day: 'dateFormat',
});

const PAYMENT_FIELDS = fields<PaymentRow>({
  paymentId: 'textFormat',
  quoteId: 'textFormat',
  version: 'integerFormat',
  mode: 'textFormat',
  status: 'textFormat',
  clientName: 'textFormat',
  projectTitle: 'textFormat',
  amountCents: 'integerFormat',
  amountUsd: 'decimalFormat',
  createdAt: 'dateTimeFormat',
  capturedAt: 'dateTimeFormat',
  day: 'dateFormat',
});

const REQUEST_FIELDS = fields<RequestRow>({
  requestId: 'textFormat',
  channel: 'textFormat',
  status: 'textFormat',
  clientName: 'textFormat',
  projectTitle: 'textFormat',
  text: 'textFormat',
  createdAt: 'dateTimeFormat',
  day: 'dateFormat',
});

const usd = (cents: number) => cents / 100;
const day = (iso: string) => iso.slice(0, 10);

export function toStudioSources(data: DashboardData): StudioSources {
  return {
    sources: [
      {
        id: 'quotes',
        name: 'Quotes',
        fields: QUOTE_FIELDS,
        data: data.quotes.map((q) => ({
          ...q,
          totalUsd: usd(q.totalCents),
          day: day(q.createdAt),
        })),
      },
      {
        id: 'lines',
        name: 'Quote lines',
        fields: LINE_FIELDS,
        data: data.lines.map((l) => ({
          ...l,
          amountUsd: usd(l.amountCents),
          day: day(l.createdAt),
        })),
      },
      {
        id: 'payments',
        name: 'Payments',
        fields: PAYMENT_FIELDS,
        data: data.payments.map((p) => ({
          ...p,
          amountUsd: usd(p.amountCents),
          day: day(p.createdAt),
        })),
      },
      {
        id: 'requests',
        name: 'Requests',
        fields: REQUEST_FIELDS,
        data: data.requests.map((r) => ({ ...r, day: day(r.createdAt) })),
      },
    ],
  };
}
