import {
  type ContextPack,
  type PricingRule,
  type QuoteLineItem,
  ruleRefLabel,
  type ScopeClause,
} from '@dealingwith/contracts';

/** `8000` → `US$80.00`, for text people and models read (never for PayPal). */
export function usd(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const remainder = String(cents % 100).padStart(2, '0');
  return `US$${dollars.toLocaleString('en-US')}.${remainder}`;
}

function renderRule(rule: PricingRule): string {
  const id = `[${ruleRefLabel(rule)}]`;
  const conditions = rule.conditions ? ` (${rule.conditions})` : '';
  switch (rule.type) {
    case 'fixed':
      return `- ${id} fixed ${usd(rule.amountCents)} — ${rule.label}${conditions}`;
    case 'per_unit':
      return `- ${id} ${usd(rule.amountCents)} per ${rule.unit} — ${rule.label}${conditions}`;
    case 'multiplier':
      return `- ${id} +${rule.percent}% — ${rule.label}${conditions}`;
  }
}

function renderClause(clause: ScopeClause): string {
  const state = clause.included ? 'included' : 'excluded';
  const source =
    clause.source.kind === 'quote'
      ? ` (paid additional, quote ${clause.source.quoteId} v${clause.source.version})`
      : '';
  return `- [${clause.id}] ${state} — ${clause.text}${source}`;
}

function renderLine(line: QuoteLineItem): string {
  const ref = line.kind === 'included' ? `[${line.scopeRef}]` : `[${ruleRefLabel(line.ruleRef)}]`;
  return `  - ${ref} ${line.label} — ${usd(line.amountCents)}`;
}

/**
 * The context pack as Markdown for the prompt. Every clause and rule shows its
 * id in brackets, so the model cites ids instead of inventing them.
 */
export function renderContextPack(pack: ContextPack): string {
  const parts: string[] = [];

  parts.push(`# Provider\n${pack.business.name}. Currency: ${pack.business.currency}.`);

  parts.push('# Services and pricing rules');
  if (pack.services.length === 0) {
    parts.push('No services published.');
  }
  for (const service of pack.services) {
    parts.push(
      [
        `## ${service.name} (delivery ${service.deliveryDays} days)`,
        service.description,
        `Includes: ${service.inclusions.join('; ') || 'nothing listed'}.`,
        `Excludes: ${service.exclusions.join('; ') || 'nothing listed'}.`,
        'Rules:',
        ...service.pricingRules.map(renderRule),
      ].join('\n'),
    );
  }

  parts.push('# Project scope');
  if (pack.project) {
    parts.push(
      [
        `Project: ${pack.project.title} (id ${pack.project.id})`,
        'Clauses (contract clauses and paid additionals alike):',
        ...pack.project.scopeClauses.map(renderClause),
      ].join('\n'),
    );
  } else {
    parts.push('No project yet: this is a new request from the storefront.');
  }

  parts.push('# Prior quotes');
  if (pack.priorQuotes.length === 0) {
    parts.push('None.');
  }
  for (const quote of pack.priorQuotes) {
    parts.push(
      [
        `- Quote ${quote.quoteId} v${quote.version}: ${quote.status}`,
        ...quote.lineItems.map(renderLine),
      ].join('\n'),
    );
  }

  parts.push('# Mandate');
  parts.push(
    pack.mandate
      ? `The client's agent may pay up to ${usd(pack.mandate.perPurchaseLimitCents)} per purchase; ${usd(pack.mandate.remainingCents)} remaining in total.`
      : 'No mandate: every payment is approved by a person.',
  );

  parts.push('# Open questions from earlier versions');
  parts.push(
    pack.openQuestions.length === 0
      ? 'None.'
      : pack.openQuestions.map((q) => `- (quote ${q.quoteId}) ${q.question}`).join('\n'),
  );

  return `${parts.join('\n\n')}\n`;
}
