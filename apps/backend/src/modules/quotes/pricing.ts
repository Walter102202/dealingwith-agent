import {
  applyPercent,
  type LineItemIntent,
  type PricingRule,
  type QuoteLineItem,
  type ScopeClause,
  type Service,
} from '@dealingwith/contracts';
import { PricingError } from './errors.js';

export type PricedQuote = { lineItems: QuoteLineItem[]; subtotalCents: number; totalCents: number };
export function resolveRule(
  services: Service[],
  ruleId: string,
): { service: Service; rule: PricingRule } | null {
  let resolved: { service: Service; rule: PricingRule } | null = null;
  for (const service of services) {
    for (const rule of service.pricingRules) {
      if (rule.id === ruleId && (!resolved || rule.version > resolved.rule.version))
        resolved = { service, rule };
    }
  }
  return resolved;
}
export function priceIntents(
  intents: LineItemIntent[],
  catalog: { services: Service[]; scopeClauses: ScopeClause[] },
): PricedQuote {
  const resolved = intents.map((intent) => {
    if (intent.kind === 'included') return null;
    const match = resolveRule(catalog.services, intent.ref.id);
    if (!match) throw new PricingError('unknown_rule', intent.ref.id);
    return match;
  });
  const bases = new Map<string, number>();
  const lineItems: QuoteLineItem[] = intents.map((intent, index) => {
    if (intent.kind === 'included') {
      const clause = catalog.scopeClauses.find((item) => item.id === intent.scopeRef);
      if (!clause) throw new PricingError('unknown_scope_ref', intent.scopeRef);
      if (!clause.included) throw new PricingError('excluded_scope_ref', intent.scopeRef);
      return { ...intent, unitAmountCents: 0, amountCents: 0 };
    }
    const match = resolved[index];
    if (!match) throw new PricingError('unknown_rule', intent.ref.id);
    const { rule, service } = match;
    const unitAmountCents = rule.type === 'multiplier' ? 0 : rule.amountCents;
    const amountCents = unitAmountCents * intent.quantity;
    if (rule.type !== 'multiplier')
      bases.set(service.id, (bases.get(service.id) ?? 0) + amountCents);
    return {
      ...intent,
      ruleRef: { id: rule.id, version: rule.version },
      unitAmountCents,
      amountCents,
    };
  });
  const subtotalCents = lineItems.reduce((sum, line) => sum + line.amountCents, 0);
  lineItems.forEach((line, index) => {
    const match = resolved[index];
    if (line.kind !== 'rule' || match?.rule.type !== 'multiplier') return;
    const amountCents = applyPercent(bases.get(match.service.id) ?? 0, match.rule.percent);
    lineItems[index] = { ...line, quantity: 1, unitAmountCents: amountCents, amountCents };
  });
  return {
    lineItems,
    subtotalCents,
    totalCents: lineItems.reduce((sum, line) => sum + line.amountCents, 0),
  };
}
