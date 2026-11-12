import type { Mandate } from '@dealingwith/contracts';
import { eq } from 'drizzle-orm';
import { mandates, projects } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { formatUsd } from '../lib/format.js';
import {
  findMandateForProject,
  getMandate,
  remainingCents,
  toMandate,
  updateMandate,
} from '../modules/mandates/mandates.js';
import { getProject } from '../modules/projects/projects.js';
import type { Deps } from './deps.js';
import { makeEvent } from './events.js';

type Limits = { perPurchaseLimitCents: number; totalLimitCents: number; expiresAt: string };
function validate(deps: Deps, input: Limits): void {
  if (
    !Number.isSafeInteger(input.perPurchaseLimitCents) ||
    !Number.isSafeInteger(input.totalLimitCents) ||
    input.perPurchaseLimitCents < 0 ||
    input.perPurchaseLimitCents > input.totalLimitCents ||
    !Number.isFinite(Date.parse(input.expiresAt)) ||
    new Date(input.expiresAt) <= deps.now()
  )
    throw new AppError(
      'invalid_mandate',
      'Limits must be non-negative cents, per-purchase must not exceed total, and expiry must be in the future',
    );
}
function publish(deps: Deps, mandate: Mandate): Mandate {
  deps.events.publish(
    makeEvent(deps, { type: 'mandate.updated', projectId: mandate.projectId, mandate }),
  );
  return mandate;
}
export async function createMandate(
  deps: Deps,
  input: Limits & { clientId: string; projectId: string },
): Promise<Mandate> {
  validate(deps, input);
  const result = await deps.db.transaction(async (tx) => {
    await tx.select().from(projects).where(eq(projects.id, input.projectId)).for('update');
    const project = await getProject(tx, input.projectId);
    if (project.clientId !== input.clientId)
      throw new AppError('invalid_mandate', 'Project does not belong to this client');
    if (await findMandateForProject(tx, input))
      throw new AppError('mandate_exists', 'A mandate already covers this project', {
        status: 409,
      });
    const [row] = await tx
      .insert(mandates)
      .values({
        ...input,
        businessId: project.businessId,
        expiresAt: new Date(input.expiresAt),
        status: 'pending',
      })
      .returning();
    if (!row)
      throw new AppError('mandate_not_created', 'Mandate could not be created', { status: 500 });
    return toMandate(row);
  });
  return publish(deps, result);
}
export async function updateMandateLimits(
  deps: Deps,
  input: Limits & { mandateId: string },
): Promise<Mandate> {
  validate(deps, input);
  return publish(
    deps,
    await updateMandate(deps.db, input.mandateId, {
      perPurchaseLimitCents: input.perPurchaseLimitCents,
      totalLimitCents: input.totalLimitCents,
      expiresAt: new Date(input.expiresAt),
      updatedAt: deps.now(),
    }),
  );
}
export async function startFunding(
  deps: Deps,
  input: { mandateId: string; fundingAmountCents: number },
): Promise<{ approvalUrl: string; orderId: string }> {
  const mandate = await getMandate(deps.db, input.mandateId);
  if (!Number.isSafeInteger(input.fundingAmountCents) || input.fundingAmountCents <= 0)
    throw new AppError('invalid_mandate', 'Funding requires a positive amount in cents');
  if (mandate.status !== 'pending' && mandate.status !== 'active')
    throw new AppError('invalid_mandate', `A ${mandate.status} mandate cannot be funded`);
  if (new Date(mandate.expiresAt) <= deps.now())
    throw new AppError('invalid_mandate', 'The mandate has expired; set a new expiry first');
  // PayPal holds at most what the agent can still spend (decision 2026-11-12-reset-unassigns-agent-budget).
  if (input.fundingAmountCents > remainingCents(mandate))
    throw new AppError(
      'invalid_mandate',
      `Funding cannot exceed what the agent can still spend, ${formatUsd(remainingCents(mandate))}`,
    );
  const order = await deps.paypal.createOrder({
    intent: 'AUTHORIZE',
    amountCents: input.fundingAmountCents,
    customId: `mandate:${mandate.id}`,
    requestId: `fund:${mandate.id}:${deps.now().toISOString()}`,
    returnUrl: `${deps.env.APP_URL}/portal/mandates/${mandate.id}/funded`,
    cancelUrl: `${deps.env.APP_URL}/portal/projects/${mandate.projectId}`,
  });
  return { approvalUrl: order.approveUrl, orderId: order.orderId };
}
export async function completeFunding(
  deps: Deps,
  input: { mandateId: string; orderId: string },
): Promise<Mandate> {
  const order = await deps.paypal.getOrder(input.orderId);
  if (order.customId !== `mandate:${input.mandateId}`)
    throw new AppError('order_mismatch', 'The order funds another mandate', { status: 403 });
  const auth = await deps.paypal.authorizeOrder(input.orderId, `authorize:${input.orderId}`);
  const result = await deps.db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(mandates)
      .where(eq(mandates.id, input.mandateId))
      .for('update');
    const m = await getMandate(tx, input.mandateId);
    if (m.status === 'revoked')
      throw new AppError('invalid_mandate', 'A revoked mandate cannot be funded');
    if (row?.paypalAuthorizationId === auth.authorizationId) return m;
    return updateMandate(tx, m.id, {
      paypalAuthorizationId: auth.authorizationId,
      fundingAmountCents: auth.amountCents,
      fundingCapturedCents: 0,
      fundingExpiresAt: auth.expiresAt ? new Date(auth.expiresAt) : null,
      status: m.status === 'exhausted' ? 'exhausted' : 'active',
      updatedAt: deps.now(),
    });
  });
  return publish(deps, result);
}
export async function revokeMandate(deps: Deps, input: { mandateId: string }): Promise<Mandate> {
  return publish(
    deps,
    await updateMandate(deps.db, input.mandateId, { status: 'revoked', updatedAt: deps.now() }),
  );
}
