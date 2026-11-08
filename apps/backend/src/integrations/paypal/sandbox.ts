import { formatPaypalAmount, parsePaypalAmount } from '@dealingwith/contracts';
import { z } from 'zod';
import { createTokenSource, PaypalHttpError, paypalJson } from './auth.js';
import { type CaptureResult, PaypalError, type PaypalGateway } from './gateway.js';

const Amount = z.object({
  currency_code: z.literal('USD'),
  value: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
});
const Capture = z.object({
  id: z.string().min(1),
  status: z.enum(['COMPLETED', 'PENDING', 'DECLINED', 'FAILED']),
  amount: Amount,
});
const Authorization = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  amount: Amount,
  expiration_time: z.string().optional(),
});
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new PaypalError('INVALID_PAYPAL_RESPONSE', 502);
  return result.data;
}
function cents(amount: z.infer<typeof Amount>): number {
  const value = parsePaypalAmount(amount.value);
  if (!Number.isSafeInteger(value)) throw new PaypalError('INVALID_PAYPAL_RESPONSE', 502);
  return value;
}
function captureResult(raw: unknown): CaptureResult {
  const capture = parse(Capture, raw);
  return {
    captureId: capture.id,
    status: capture.status === 'FAILED' ? 'DECLINED' : capture.status,
    amountCents: cents(capture.amount),
    raw,
  };
}
export class SandboxPaypalGateway implements PaypalGateway {
  private readonly tokenSource;
  private readonly fetch: typeof globalThis.fetch;
  constructor(
    private readonly options: {
      clientId: string;
      clientSecret: string;
      webhookId?: string;
      fetch?: typeof globalThis.fetch;
    },
  ) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.tokenSource = createTokenSource(options);
  }
  private async request(
    path: string,
    body?: unknown,
    requestId?: string,
    retry = true,
  ): Promise<unknown> {
    const token = await this.tokenSource.getAccessToken();
    try {
      return await paypalJson(
        path,
        {
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
            ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        this.fetch,
      );
    } catch (error) {
      if (error instanceof PaypalHttpError && error.httpStatus === 401) {
        this.tokenSource.invalidate(token);
        if (retry) return this.request(path, body, requestId, false);
      }
      throw error;
    }
  }
  async createOrder(
    input: Parameters<PaypalGateway['createOrder']>[0],
  ): ReturnType<PaypalGateway['createOrder']> {
    const raw = await this.request(
      '/v2/checkout/orders',
      {
        intent: input.intent,
        purchase_units: [
          {
            reference_id: 'default',
            custom_id: input.customId,
            amount: { currency_code: 'USD', value: formatPaypalAmount(input.amountCents) },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'DealingWith Agent',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'PAY_NOW',
              return_url: input.returnUrl,
              cancel_url: input.cancelUrl,
            },
          },
        },
      },
      input.requestId,
    );
    const order = parse(
      z.object({
        id: z.string().min(1),
        links: z.array(z.object({ rel: z.string(), href: z.string().min(1) })).default([]),
      }),
      raw,
    );
    const approveUrl = (
      order.links.find((link) => link.rel === 'payer-action') ??
      order.links.find((link) => link.rel === 'approve')
    )?.href;
    if (!approveUrl) throw new PaypalError('APPROVE_LINK_MISSING', 502);
    return { orderId: order.id, approveUrl, raw };
  }
  async getOrder(id: string): ReturnType<PaypalGateway['getOrder']> {
    const raw = await this.request(`/v2/checkout/orders/${encodeURIComponent(id)}`);
    const order = parse(
      z.object({
        id: z.string(),
        intent: z.enum(['CAPTURE', 'AUTHORIZE']),
        status: z.enum([
          'CREATED',
          'SAVED',
          'PAYER_ACTION_REQUIRED',
          'APPROVED',
          'COMPLETED',
          'VOIDED',
          'EXPIRED',
        ]),
        purchase_units: z
          .array(
            z.object({
              amount: Amount,
              custom_id: z.string(),
              payments: z
                .object({
                  captures: z.array(z.object({ id: z.string(), status: z.string() })).optional(),
                  authorizations: z.array(z.object({ id: z.string() })).optional(),
                })
                .optional(),
            }),
          )
          .min(1),
      }),
      raw,
    );
    const unit = order.purchase_units[0];
    if (!unit) throw new PaypalError('INVALID_PAYPAL_RESPONSE', 502);
    const captureId = unit.payments?.captures?.find(
      (capture) => capture.status === 'COMPLETED',
    )?.id;
    const authorizationId = unit.payments?.authorizations?.[0]?.id;
    return {
      orderId: order.id,
      intent: order.intent,
      status:
        order.status === 'SAVED' || order.status === 'PAYER_ACTION_REQUIRED'
          ? 'CREATED'
          : order.status,
      amountCents: cents(unit.amount),
      customId: unit.custom_id,
      ...(captureId ? { captureId } : {}),
      ...(authorizationId ? { authorizationId } : {}),
      raw,
    };
  }
  async captureOrder(id: string, requestId: string): Promise<CaptureResult> {
    const raw = await this.request(
      `/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
      {},
      requestId,
    );
    const order = parse(
      z.object({
        purchase_units: z
          .array(z.object({ payments: z.object({ captures: z.array(z.unknown()).min(1) }) }))
          .min(1),
      }),
      raw,
    );
    return captureResult(order.purchase_units[0]?.payments.captures[0]);
  }
  async authorizeOrder(id: string, requestId: string): ReturnType<PaypalGateway['authorizeOrder']> {
    const raw = await this.request(
      `/v2/checkout/orders/${encodeURIComponent(id)}/authorize`,
      {},
      requestId,
    );
    const order = parse(
      z.object({
        purchase_units: z
          .array(
            z.object({ payments: z.object({ authorizations: z.array(Authorization).min(1) }) }),
          )
          .min(1),
      }),
      raw,
    );
    const auth = order.purchase_units[0]?.payments.authorizations[0];
    if (!auth) throw new PaypalError('INVALID_PAYPAL_RESPONSE', 502);
    if (auth.status !== 'CREATED') throw new PaypalError(auth.status, 502);
    return {
      authorizationId: auth.id,
      amountCents: cents(auth.amount),
      expiresAt: auth.expiration_time ?? null,
      raw,
    };
  }
  async captureAuthorization(
    id: string,
    input: Parameters<PaypalGateway['captureAuthorization']>[1],
  ): Promise<CaptureResult> {
    return captureResult(
      await this.request(
        `/v2/payments/authorizations/${encodeURIComponent(id)}/capture`,
        {
          amount: { currency_code: 'USD', value: formatPaypalAmount(input.amountCents) },
          final_capture: input.finalCapture,
          invoice_id: input.invoiceId,
        },
        input.requestId,
      ),
    );
  }
  async verifyWebhookSignature(headers: Record<string, string>, rawBody: string): Promise<boolean> {
    if (!this.options.webhookId?.trim()) return false;
    const normalized = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
    );
    const fields = {
      auth_algo: normalized['paypal-auth-algo'],
      cert_url: normalized['paypal-cert-url'],
      transmission_id: normalized['paypal-transmission-id'],
      transmission_sig: normalized['paypal-transmission-sig'],
      transmission_time: normalized['paypal-transmission-time'],
    };
    if (Object.values(fields).some((value) => !value?.trim())) return false;
    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return false;
    }
    const result = await this.request('/v1/notifications/verify-webhook-signature', {
      ...fields,
      webhook_id: this.options.webhookId,
      webhook_event: event,
    });
    return (
      parse(z.object({ verification_status: z.enum(['SUCCESS', 'FAILURE']) }), result)
        .verification_status === 'SUCCESS'
    );
  }
}
