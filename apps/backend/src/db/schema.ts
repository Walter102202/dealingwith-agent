import type {
  MandateStatus,
  NeedsInfoItem,
  PaymentMode,
  PaymentStatus,
  PricingRule,
  ProjectStatus,
  QuoteLineItem,
  QuoteStatus,
  ScopeClause,
} from '@dealingwith/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Domain model, spec section 7.1. Ten tables, snake_case columns, uuid primary
 * keys, timestamptz timestamps, integer cents for every amount.
 */

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => timestamptz('created_at').notNull().defaultNow();
const updatedAt = () => timestamptz('updated_at').notNull().defaultNow();
const cents = (name: string) => integer(name).notNull();

export const projectStatus = pgEnum('project_status', ['in_progress', 'completed', 'cancelled']);
export const requestChannel = pgEnum('request_channel', ['web', 'mcp']);
export const requestStatus = pgEnum('request_status', ['open', 'quoted', 'needs_info', 'failed']);
export const quoteStatus = pgEnum('quote_status', [
  'draft',
  'needs_info',
  'published',
  'accepted',
  'paid',
  'superseded',
  'expired',
  'rejected',
]);
export const paymentMode = pgEnum('payment_mode', ['pay_now', 'mandate']);
export const paymentStatus = pgEnum('payment_status', [
  'created',
  'approved',
  'captured',
  'denied',
  'refunded',
]);
export const mandateStatus = pgEnum('mandate_status', [
  'pending',
  'active',
  'exhausted',
  'expired',
  'revoked',
]);

export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  currency: text('currency').notNull().default('USD'),
  demoMode: boolean('demo_mode').notNull().default(true),
  createdAt: createdAt(),
});

export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    pricingRules: jsonb('pricing_rules').$type<PricingRule[]>().notNull().default([]),
    inclusions: text('inclusions').array().notNull().default(sql`'{}'::text[]`),
    exclusions: text('exclusions').array().notNull().default(sql`'{}'::text[]`),
    deliveryDays: integer('delivery_days').notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index('services_business_idx').on(table.businessId)],
);

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    name: text('name').notNull(),
    email: text('email').notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('clients_business_idx').on(table.businessId)],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id),
    title: text('title').notNull(),
    status: projectStatus('status').notNull().default('in_progress').$type<ProjectStatus>(),
    scopeClauses: jsonb('scope_clauses').$type<ScopeClause[]>().notNull().default([]),
    totalContractedCents: cents('total_contracted_cents').default(0),
    contractedAt: timestamptz('contracted_at').notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (table) => [index('projects_client_idx').on(table.clientId)],
);

export const mandates = pgTable(
  'mandates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    perPurchaseLimitCents: cents('per_purchase_limit_cents'),
    totalLimitCents: cents('total_limit_cents'),
    spentCents: cents('spent_cents').default(0),
    currency: text('currency').notNull().default('USD'),
    expiresAt: timestamptz('expires_at').notNull(),
    status: mandateStatus('status').notNull().default('pending').$type<MandateStatus>(),
    // Funding: the PayPal authorization that backs the policy limits (spec 7.4, Flow B).
    paypalAuthorizationId: text('paypal_authorization_id'),
    fundingAmountCents: cents('funding_amount_cents').default(0),
    fundingCapturedCents: cents('funding_captured_cents').default(0),
    fundingExpiresAt: timestamptz('funding_expires_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('mandates_project_idx').on(table.projectId)],
);

export const clientAgents = pgTable(
  'client_agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    label: text('label').notNull(),
    tokenHash: text('token_hash').notNull(),
    scopes: text('scopes').array().notNull().default(sql`'{}'::text[]`),
    mandateId: uuid('mandate_id').references(() => mandates.id),
    createdAt: createdAt(),
    lastUsedAt: timestamptz('last_used_at'),
    revokedAt: timestamptz('revoked_at'),
  },
  (table) => [uniqueIndex('client_agents_token_hash_key').on(table.tokenHash)],
);

export const requests = pgTable(
  'requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    channel: requestChannel('channel').notNull(),
    agentId: uuid('agent_id').references(() => clientAgents.id),
    text: text('text').notNull(),
    status: requestStatus('status').notNull().default('open'),
    createdAt: createdAt(),
  },
  (table) => [index('requests_project_idx').on(table.projectId)],
);

/**
 * One row per quote version. `quote_id` is the stable identifier clients see;
 * `(quote_id, version)` is what accept and pay reference.
 */
export const quotes = pgTable(
  'quotes',
  {
    quoteId: uuid('quote_id').notNull().defaultRandom(),
    version: integer('version').notNull(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => requests.id),
    projectId: uuid('project_id').references(() => projects.id),
    status: quoteStatus('status').notNull().default('draft').$type<QuoteStatus>(),
    lineItems: jsonb('line_items').$type<QuoteLineItem[]>().notNull().default([]),
    subtotalCents: cents('subtotal_cents').default(0),
    totalCents: cents('total_cents').default(0),
    currency: text('currency').notNull().default('USD'),
    explanation: text('explanation').notNull().default(''),
    deliveryDays: integer('delivery_days').notNull().default(0),
    needsInfo: jsonb('needs_info').$type<NeedsInfoItem[]>().notNull().default([]),
    agentRunId: uuid('agent_run_id'),
    publishedAt: timestamptz('published_at'),
    acceptedAt: timestamptz('accepted_at'),
    /** The connected agent that accepted this version, with or without a payment; null when a person accepted on the web. */
    acceptedAgentId: uuid('accepted_agent_id').references(() => clientAgents.id),
    paidAt: timestamptz('paid_at'),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.quoteId, table.version] }),
    uniqueIndex('quotes_request_version_key').on(table.requestId, table.version),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteId: uuid('quote_id').notNull(),
    quoteVersion: integer('quote_version').notNull(),
    mode: paymentMode('mode').notNull().$type<PaymentMode>(),
    /** The connected agent whose accept created this payment; null when a person accepted on the web. */
    agentId: uuid('agent_id').references(() => clientAgents.id),
    paypalOrderId: text('paypal_order_id'),
    paypalAuthorizationId: text('paypal_authorization_id'),
    paypalCaptureId: text('paypal_capture_id'),
    amountCents: cents('amount_cents'),
    currency: text('currency').notNull().default('USD'),
    status: paymentStatus('status').notNull().default('created').$type<PaymentStatus>(),
    idempotencyKey: text('idempotency_key').notNull(),
    raw: jsonb('raw').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: 'payments_quote_fk',
      columns: [table.quoteId, table.quoteVersion],
      foreignColumns: [quotes.quoteId, quotes.version],
    }),
    uniqueIndex('payments_idempotency_key_key').on(table.idempotencyKey),
    index('payments_quote_idx').on(table.quoteId, table.quoteVersion),
  ],
);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paypalEventId: text('paypal_event_id').notNull(),
    eventType: text('event_type').notNull(),
    resourceId: text('resource_id'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamptz('received_at').notNull().defaultNow(),
    processedAt: timestamptz('processed_at'),
    result: text('result'),
  },
  (table) => [uniqueIndex('webhook_events_paypal_event_id_key').on(table.paypalEventId)],
);

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => requests.id),
    quoteId: uuid('quote_id'),
    quoteVersion: integer('quote_version'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    latencyMs: integer('latency_ms'),
    outcome: text('outcome').notNull(),
    error: text('error'),
    createdAt: createdAt(),
  },
  (table) => [index('agent_runs_request_idx').on(table.requestId)],
);
