import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';

interface PayPalSandboxButtonsProps {
  clientId: string;
  /** Accepts the quote on our backend and returns the PayPal order id. */
  createOrder: () => Promise<string>;
  /** Captures the approved order on our backend. */
  onApprove: (orderId: string) => Promise<void>;
  onError: (error: unknown) => void;
}

/**
 * The PayPal JS SDK buttons (sandbox mode). Loaded lazily by `PayWithPayPal`
 * so the SDK script never loads in mock mode or in tests.
 */
export default function PayPalSandboxButtons({
  clientId,
  createOrder,
  onApprove,
  onError,
}: PayPalSandboxButtonsProps) {
  return (
    <PayPalScriptProvider options={{ clientId, currency: 'USD', intent: 'capture' }}>
      <PayPalButtons
        style={{ layout: 'horizontal', color: 'gold', tagline: false, height: 40 }}
        createOrder={createOrder}
        onApprove={(data) => onApprove(data.orderID)}
        onError={onError}
      />
    </PayPalScriptProvider>
  );
}
