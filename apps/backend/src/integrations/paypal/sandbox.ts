import { PaypalError, type PaypalGateway } from './gateway.js';
/** Replaced by the real sandbox integration in task I1. */
export class SandboxPaypalGateway implements PaypalGateway {
  constructor(private readonly webhookId?: string) {}
  async createOrder(
    _input: Parameters<PaypalGateway['createOrder']>[0],
  ): ReturnType<PaypalGateway['createOrder']> {
    throw new PaypalError('SANDBOX_NOT_IMPLEMENTED', 501);
  }
  async getOrder(_id: string): ReturnType<PaypalGateway['getOrder']> {
    throw new PaypalError('SANDBOX_NOT_IMPLEMENTED', 501);
  }
  async captureOrder(_id: string, _requestId: string): ReturnType<PaypalGateway['captureOrder']> {
    throw new PaypalError('SANDBOX_NOT_IMPLEMENTED', 501);
  }
  async authorizeOrder(
    _id: string,
    _requestId: string,
  ): ReturnType<PaypalGateway['authorizeOrder']> {
    throw new PaypalError('SANDBOX_NOT_IMPLEMENTED', 501);
  }
  async captureAuthorization(
    _id: string,
    _input: Parameters<PaypalGateway['captureAuthorization']>[1],
  ): ReturnType<PaypalGateway['captureAuthorization']> {
    throw new PaypalError('SANDBOX_NOT_IMPLEMENTED', 501);
  }
  async verifyWebhookSignature(
    _headers: Record<string, string>,
    _rawBody: string,
  ): Promise<boolean> {
    if (!this.webhookId?.trim()) return false;
    throw new PaypalError('SANDBOX_NOT_IMPLEMENTED', 501);
  }
}
