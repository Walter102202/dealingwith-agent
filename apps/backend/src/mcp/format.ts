import {
  type AcceptQuoteResult,
  formatUsd,
  type Mandate,
  type Payment,
  type Project,
  type Quote,
  type Service,
} from '@dealingwith/contracts';

/** Markdown views of the tool outputs, so every MCP client renders the same text. */

export function formatQuoteMarkdown(quote: Quote): string {
  const lines = [
    `# Quote ${quote.id} v${quote.version} — ${quote.status}`,
    '',
    ...quote.lineItems.map(
      (line) => `- ${line.label}: ${formatUsd(line.amountCents)} (${line.rationale})`,
    ),
    '',
    `Total: ${formatUsd(quote.totalCents)}`,
    `Delivery: ${quote.deliveryDays} days`,
    '',
    quote.explanation,
  ];
  if (quote.status === 'needs_info' && quote.needsInfo.length)
    lines.push(
      '',
      'Questions:',
      ...quote.needsInfo.map((item) => `- ${item.question} (${item.whyItChangesPrice})`),
    );
  return lines.join('\n');
}

export function formatServicesMarkdown(services: Service[]): string {
  if (!services.length) return 'No services published.';
  return services
    .map((service) =>
      [
        `## ${service.name} (${service.id})`,
        service.description,
        `Delivery: ${service.deliveryDays} days`,
        ...service.pricingRules.map((rule) => {
          const price =
            rule.type === 'multiplier'
              ? `+${rule.percent}%`
              : rule.type === 'per_unit'
                ? `${formatUsd(rule.amountCents)} per ${rule.unit}`
                : formatUsd(rule.amountCents);
          return `- ${rule.id}.v${rule.version} ${rule.label}: ${price}`;
        }),
        ...(service.inclusions.length ? [`Includes: ${service.inclusions.join('; ')}`] : []),
        ...(service.exclusions.length ? [`Excludes: ${service.exclusions.join('; ')}`] : []),
      ].join('\n'),
    )
    .join('\n\n');
}

export function formatProjectMarkdown(project: Project): string {
  return [
    `# ${project.title} (${project.id}) — ${project.status}`,
    `Contracted: ${formatUsd(project.totalContractedCents)}`,
    '',
    'Scope:',
    ...project.scopeClauses.map(
      (clause) => `- ${clause.id} ${clause.included ? 'included' : 'excluded'}: ${clause.text}`,
    ),
  ].join('\n');
}

export function formatAcceptResultMarkdown(result: AcceptQuoteResult): string {
  if (result.status === 'paid')
    return result.payment
      ? `Paid ${formatUsd(result.payment.amountCents)} (payment ${result.payment.id}).`
      : `Paid. ${result.message ?? ''}`.trim();
  if (result.status === 'approval_required')
    return `Approval required: ${result.message ?? 'A human must approve this payment.'} Open ${result.approvalUrl} to pay with PayPal.`;
  return `Denied: ${result.message ?? result.reason ?? 'The quote cannot be accepted.'}`;
}

export function formatPaymentMarkdown(payment: Payment): string {
  return [
    `Payment ${payment.id}: ${payment.status}`,
    `Amount: ${formatUsd(payment.amountCents)} (${payment.mode})`,
    `Quote: ${payment.quoteId} v${payment.quoteVersion}`,
    ...(payment.paypalCaptureId ? [`PayPal capture: ${payment.paypalCaptureId}`] : []),
    ...(payment.paypalOrderId ? [`PayPal order: ${payment.paypalOrderId}`] : []),
  ].join('\n');
}

export function formatMandateMarkdown(mandate: Mandate | null): string {
  if (!mandate) return 'This agent has no mandate: every accepted quote needs human approval.';
  return [
    `Mandate ${mandate.id}: ${mandate.status}`,
    `Per purchase limit: ${formatUsd(mandate.perPurchaseLimitCents)}`,
    `Total limit: ${formatUsd(mandate.totalLimitCents)} (spent ${formatUsd(mandate.spentCents)})`,
    `Expires: ${mandate.expiresAt}`,
    `Backed by PayPal authorization: ${mandate.funding.paypalAuthorizationId ? 'yes' : 'not yet'}`,
  ].join('\n');
}
