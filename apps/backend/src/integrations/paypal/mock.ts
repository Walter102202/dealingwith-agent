import { formatPaypalAmount } from '@dealingwith/contracts';
import { createLogger } from '../../observability/logger.js';
import {
  type CaptureResult,
  type OrderStatus,
  PaypalError,
  type PaypalGateway,
} from './gateway.js';

type OrderInput = Parameters<PaypalGateway['createOrder']>[0];
type Order = OrderInput & {
  orderId: string;
  status: OrderStatus;
  captureId?: string;
  authorizationId?: string;
};
export type MockWebhookEvent = {
  id: string;
  event_type: string;
  create_time: string;
  resource_type: string;
  resource: Record<string, unknown>;
};
export type MockOptions = {
  appUrl: string;
  webhookSecret: string;
  deliverWebhook?: (event: MockWebhookEvent, headers: Record<string, string>) => Promise<void>;
  now?: () => Date;
};
export class MockPaypalGateway implements PaypalGateway {
  private orders = new Map<string, Order>();
  private authorizations = new Map<string, { order: Order; captured: number; closed: boolean }>();
  private results = new Map<string, unknown>();
  private emitted: MockWebhookEvent[] = [];
  private captureSequence = 0;
  constructor(private readonly options: MockOptions) {}
  private id(prefix: string, n: number): string {
    return `${prefix}${String(n).padStart(6, '0')}`;
  }
  private order(id: string): Order {
    const order = this.orders.get(id);
    if (!order) throw new PaypalError('RESOURCE_NOT_FOUND', 404);
    return order;
  }
  private raw(order: Order): Record<string, unknown> {
    return {
      id: order.orderId,
      intent: order.intent,
      status: order.status,
      purchase_units: [
        {
          custom_id: order.customId,
          amount: { currency_code: 'USD', value: formatPaypalAmount(order.amountCents) },
        },
      ],
      links: [
        { rel: 'approve', href: `${this.options.appUrl}/mock-paypal/approve/${order.orderId}` },
      ],
    };
  }
  async createOrder(input: OrderInput): ReturnType<PaypalGateway['createOrder']> {
    const key = `create:${input.requestId}`;
    if (this.results.has(key))
      return structuredClone(this.results.get(key)) as Awaited<
        ReturnType<PaypalGateway['createOrder']>
      >;
    this.validateAmount(input.amountCents);
    const order: Order = {
      ...input,
      orderId: this.id('MOCK-ORDER-', this.orders.size + 1),
      status: 'CREATED',
    };
    this.orders.set(order.orderId, order);
    const result = {
      orderId: order.orderId,
      approveUrl: `${this.options.appUrl}/mock-paypal/approve/${order.orderId}`,
      raw: this.raw(order),
    };
    this.results.set(key, result);
    return structuredClone(result);
  }
  async getOrder(orderId: string): ReturnType<PaypalGateway['getOrder']> {
    const o = this.order(orderId);
    return { ...o, raw: this.raw(o) };
  }
  redirectUrls(orderId: string): { returnUrl: string; cancelUrl: string } {
    const o = this.order(orderId);
    return { returnUrl: o.returnUrl, cancelUrl: o.cancelUrl };
  }
  async approve(orderId: string, payerId = 'MOCKPAYER01'): Promise<void> {
    const order = this.order(orderId);
    if (order.status === 'EXPIRED') throw new PaypalError('ORDER_EXPIRED');
    if (order.status !== 'CREATED') return;
    order.status = 'APPROVED';
    await this.emitWebhook('CHECKOUT.ORDER.APPROVED', {
      ...this.raw(order),
      payer: { payer_id: payerId },
    });
  }
  private ready(order: Order, intent: OrderInput['intent']): void {
    if (order.status === 'EXPIRED') throw new PaypalError('ORDER_EXPIRED');
    if (order.intent !== intent) throw new PaypalError('ORDER_INTENT_MISMATCH');
    if (order.status === 'COMPLETED') throw new PaypalError('ORDER_ALREADY_CAPTURED');
    if (order.status !== 'APPROVED') throw new PaypalError('ORDER_NOT_APPROVED');
  }
  private capture(order: Order, amountCents: number, authorizationId?: string): CaptureResult {
    const captureId = this.id('MOCK-CAP-', ++this.captureSequence);
    return {
      captureId,
      status: 'COMPLETED',
      amountCents,
      raw: {
        id: captureId,
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: formatPaypalAmount(amountCents) },
        custom_id: order.customId,
        supplementary_data: {
          related_ids: {
            order_id: order.orderId,
            ...(authorizationId ? { authorization_id: authorizationId } : {}),
          },
        },
      },
    };
  }
  async captureOrder(orderId: string, requestId: string): Promise<CaptureResult> {
    const key = `capture:${requestId}`;
    if (this.results.has(key)) return structuredClone(this.results.get(key)) as CaptureResult;
    const order = this.order(orderId);
    this.ready(order, 'CAPTURE');
    const result = this.capture(order, order.amountCents);
    order.status = 'COMPLETED';
    order.captureId = result.captureId;
    this.results.set(key, result);
    await this.emitWebhook('PAYMENT.CAPTURE.COMPLETED', result.raw as Record<string, unknown>);
    return structuredClone(result);
  }
  async authorizeOrder(
    orderId: string,
    requestId: string,
  ): ReturnType<PaypalGateway['authorizeOrder']> {
    const key = `authorize:${requestId}`;
    if (this.results.has(key))
      return structuredClone(this.results.get(key)) as Awaited<
        ReturnType<PaypalGateway['authorizeOrder']>
      >;
    const order = this.order(orderId);
    this.ready(order, 'AUTHORIZE');
    const authorizationId = this.id('MOCK-AUTH-', this.authorizations.size + 1);
    this.authorizations.set(authorizationId, { order, captured: 0, closed: false });
    order.status = 'COMPLETED';
    order.authorizationId = authorizationId;
    const raw = {
      id: authorizationId,
      status: 'CREATED',
      amount: { currency_code: 'USD', value: formatPaypalAmount(order.amountCents) },
      custom_id: order.customId,
    };
    const result = { authorizationId, amountCents: order.amountCents, expiresAt: null, raw };
    this.results.set(key, result);
    await this.emitWebhook('PAYMENT.AUTHORIZATION.CREATED', raw);
    return structuredClone(result);
  }
  async captureAuthorization(
    authorizationId: string,
    input: Parameters<PaypalGateway['captureAuthorization']>[1],
  ): Promise<CaptureResult> {
    const key = `partial:${input.requestId}`;
    if (this.results.has(key)) return structuredClone(this.results.get(key)) as CaptureResult;
    const auth = this.authorizations.get(authorizationId);
    if (!auth) throw new PaypalError('RESOURCE_NOT_FOUND', 404);
    this.validateAmount(input.amountCents);
    if (auth.closed || input.amountCents > auth.order.amountCents - auth.captured)
      throw new PaypalError('AUTHORIZATION_AMOUNT_EXCEEDED');
    const result = this.capture(auth.order, input.amountCents, authorizationId);
    auth.captured += input.amountCents;
    auth.closed = input.finalCapture;
    this.results.set(key, result);
    await this.emitWebhook('PAYMENT.CAPTURE.COMPLETED', result.raw as Record<string, unknown>);
    return structuredClone(result);
  }
  async verifyWebhookSignature(
    headers: Record<string, string>,
    _rawBody: string,
  ): Promise<boolean> {
    return Object.entries(headers).some(
      ([key, value]) =>
        key.toLowerCase() === 'x-mock-signature' && value === this.options.webhookSecret,
    );
  }
  async emitWebhook(eventType: string, resource: Record<string, unknown>): Promise<void> {
    const event: MockWebhookEvent = {
      id: this.id('WH-mock-', this.emitted.length + 1),
      event_type: eventType,
      create_time: (this.options.now?.() ?? new Date()).toISOString(),
      resource_type: eventType.startsWith('CHECKOUT') ? 'checkout-order' : 'payment',
      resource: structuredClone(resource),
    };
    this.emitted.push(event);
    const headers = {
      'content-type': 'application/json',
      'x-mock-signature': this.options.webhookSecret,
    };
    try {
      if (this.options.deliverWebhook)
        await this.options.deliverWebhook(structuredClone(event), headers);
      else {
        const response = await fetch(`${this.options.appUrl}/api/webhooks/paypal`, {
          method: 'POST',
          headers,
          body: JSON.stringify(event),
        });
        if (!response.ok) throw new PaypalError('WEBHOOK_DELIVERY_FAILED', 502);
      }
    } catch {
      createLogger().warn('mock.webhook_delivery_failed', { eventId: event.id });
    }
  }
  events(): MockWebhookEvent[] {
    return structuredClone(this.emitted);
  }
  expireOrder(orderId: string): void {
    this.order(orderId).status = 'EXPIRED';
  }
  private validateAmount(cents: number): void {
    if (!Number.isSafeInteger(cents) || cents < 0) throw new PaypalError('INVALID_AMOUNT');
  }
}
