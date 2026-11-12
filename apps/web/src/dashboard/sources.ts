import type {
  DashboardData,
  DashboardLineRow,
  DashboardPaymentRow,
  DashboardQuoteRow,
  DashboardRequestRow,
  RequestChannel,
} from '@dealingwith/contracts';
import type { AgFieldDefinition } from 'ag-studio';
import { CENTS } from './widgets/money.js';

/**
 * AG Studio takes arrays of flat plain objects per source. Each row keeps its
 * cents fields and gains `…Usd` columns for charting only (display, not
 * pricing) plus a `day` column so time series group cleanly.
 *
 * Fields are declared explicitly rather than inferred from the rows: right
 * after "Reset demo data" every source is empty, and an inferred schema would
 * have no fields, so the saved dashboard definition would fail validation.
 *
 * Cents fields carry `context: CENTS`, which the custom widgets read to format
 * them with `formatUsd` (decision 2026-11-10-studio-custom-widgets).
 */

type Row = Record<string, string | number | boolean | null>;

export type SourceId = 'quotes' | 'lines' | 'payments' | 'requests' | 'mandates';

export interface StudioSource<T extends Row = Row> {
  id: SourceId;
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
    StudioSource<MandateRow>,
  ];
}

export type QuoteRow = DashboardQuoteRow & { totalUsd: number; day: string };
export type LineRow = DashboardLineRow & { amountUsd: number; day: string };
/** `channel` is the channel of the request behind the paid quote, joined here so payments group by it. */
export type PaymentRow = DashboardPaymentRow & {
  amountUsd: number;
  day: string;
  channel: RequestChannel | null;
};
export type RequestRow = DashboardRequestRow & { day: string };
/** The demo mandate: what the client's agent may spend, as one row (none before it exists). */
export type MandateRow = {
  mandateId: string;
  status: string;
  spentCents: number;
  totalLimitCents: number;
  perPurchaseLimitCents: number;
  expiresOn: string;
};

type Format =
  | 'textFormat'
  | 'integerFormat'
  | 'decimalFormat'
  | 'dateFormat'
  | 'dateTimeFormat'
  | 'cents';

/** "quoteStatus" → "Quote status". */
const humanize = (id: string) => {
  const spaced = id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/**
 * Display words for coded values. The values themselves stay as the contracts
 * define them (`mcp`, `needs_info`, `pay_now`), since filters match on them;
 * every widget shows the words the product uses.
 */
const WORDS: Record<string, string> = {
  mcp: 'agent',
  needs_info: 'Needs info',
  pay_now: 'Pay now',
  mandate: 'Agent mandate',
  // Only mandates are `pending`: limits proposed, no PayPal authorization yet.
  pending: 'Not assigned yet',
};
const word = (value: string) =>
  WORDS[value] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);
const CODED = new Set(['channel', 'status', 'quoteStatus', 'mode']);
/** `web` and `mcp` read as they are written elsewhere in the product: lower case. */
const channelWord = (value: string) => WORDS[value] ?? value;

const fields = <T extends Row>(spec: Record<keyof T & string, Format>): AgFieldDefinition[] =>
  Object.entries(spec).map(([id, format]): AgFieldDefinition => {
    const name = humanize(id);
    if (format === 'cents') return { id, name, format: 'integerFormat', context: CENTS };
    if (!CODED.has(id)) return { id, name, format };
    const formatter = id === 'channel' ? channelWord : word;
    return { id, name, format, createValueFormatter: () => formatter };
  });

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
  totalCents: 'cents',
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
  amountCents: 'cents',
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
  channel: 'textFormat',
  clientName: 'textFormat',
  projectTitle: 'textFormat',
  amountCents: 'cents',
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

/** "31 Dec 2026", as the project page writes the mandate's expiry. */
const EXPIRY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const MANDATE_FIELDS = fields<MandateRow>({
  mandateId: 'textFormat',
  status: 'textFormat',
  spentCents: 'cents',
  totalLimitCents: 'cents',
  perPurchaseLimitCents: 'cents',
  expiresOn: 'dateFormat',
}).map((f) => (f.id === 'expiresOn' ? { ...f, formatOptions: { format: EXPIRY } } : f));

const usd = (cents: number) => cents / 100;
const day = (iso: string) => iso.slice(0, 10);

export function toStudioSources(data: DashboardData): StudioSources {
  const channelOf = new Map(data.quotes.map((q) => [`${q.quoteId}:${q.version}`, q.channel]));
  const { mandate } = data;
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
          channel: channelOf.get(`${p.quoteId}:${p.version}`) ?? null,
        })),
      },
      {
        id: 'requests',
        name: 'Requests',
        fields: REQUEST_FIELDS,
        data: data.requests.map((r) => ({ ...r, day: day(r.createdAt) })),
      },
      {
        id: 'mandates',
        name: 'Agent mandate',
        fields: MANDATE_FIELDS,
        data: mandate
          ? [
              {
                mandateId: mandate.id,
                status: mandate.status,
                spentCents: mandate.spentCents,
                totalLimitCents: mandate.totalLimitCents,
                perPurchaseLimitCents: mandate.perPurchaseLimitCents,
                expiresOn: day(mandate.expiresAt),
              },
            ]
          : [],
      },
    ],
  };
}
