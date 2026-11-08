import { AppError } from '../../lib/errors.js';
export type OrderIntent = 'CAPTURE' | 'AUTHORIZE';
export type OrderStatus = 'CREATED' | 'APPROVED' | 'COMPLETED' | 'VOIDED' | 'EXPIRED';
export type CaptureResult = {
  captureId: string;
  status: 'COMPLETED' | 'PENDING' | 'DECLINED';
  amountCents: number;
  raw: unknown;
};
export interface PaypalGateway {
  createOrder(i: {
    intent: OrderIntent;
    amountCents: number;
    customId: string;
    requestId: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ orderId: string; approveUrl: string; raw: unknown }>;
  getOrder(orderId: string): Promise<{
    orderId: string;
    intent: OrderIntent;
    status: OrderStatus;
    amountCents: number;
    customId: string;
    captureId?: string;
    authorizationId?: string;
    raw: unknown;
  }>;
  captureOrder(orderId: string, requestId: string): Promise<CaptureResult>;
  authorizeOrder(
    orderId: string,
    requestId: string,
  ): Promise<{
    authorizationId: string;
    amountCents: number;
    expiresAt: string | null;
    raw: unknown;
  }>;
  captureAuthorization(
    authorizationId: string,
    i: { amountCents: number; finalCapture: boolean; requestId: string },
  ): Promise<CaptureResult>;
  verifyWebhookSignature(headers: Record<string, string>, rawBody: string): Promise<boolean>;
}
export class PaypalError extends AppError {
  constructor(code: string, status = 422, message = code.replaceAll('_', ' ')) {
    super(code, message, { status });
    this.name = 'PaypalError';
  }
}
