'use client';

import { FUNDING, PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { StateBlock } from '@/components/ui/state-block';
import { api } from '@/lib/api';

interface CartItem {
  id: string;
  title: string;
  price: number;
  currency: string;
  image: string;
}

interface ShippingAddress {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface PayPalCheckoutButtonProps {
  cartItems: CartItem[];
  shippingAddress: ShippingAddress;
  total: number;
  currency: string;
  onSuccess: (orderId: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  useAuth?: boolean;
  applyStoreCredit?: boolean;
  /**
   * Fit a 48px row — the phone sticky bar. Renders the single PayPal funding source at
   * that height and swaps the padded message boxes for 48px placeholders.
   */
  compact?: boolean;
}

export default function PayPalCheckoutButton({
  cartItems,
  shippingAddress,
  total,
  currency,
  onSuccess,
  onError,
  disabled = false,
  useAuth = true,
  applyStoreCredit = false,
  compact = false,
}: PayPalCheckoutButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!clientId) {
    return compact ? (
      <span className="font-btn flex h-12 items-center justify-center border border-foreground/30 text-[13px] text-foreground/40">
        PayPal not configured
      </span>
    ) : (
      <StateBlock variant="error">PayPal not configured</StateBlock>
    );
  }

  if (disabled) {
    return compact ? (
      <button
        type="button"
        disabled
        className="font-btn flex h-12 w-full cursor-not-allowed items-center justify-center bg-primary text-[13px] text-primary-foreground opacity-50"
      >
        Pay with PayPal
      </button>
    ) : (
      <StateBlock variant="warning">Please fill in shipping address first</StateBlock>
    );
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: currency || 'USD',
      }}
    >
      <PayPalButtons
        // A standalone PayPal button takes an explicit height (PayPal allows 25–55px);
        // the stacked vertical set would run far taller than the 48px bar it sits in.
        fundingSource={compact ? FUNDING.PAYPAL : undefined}
        className={compact ? 'h-12' : undefined}
        style={
          compact
            ? { color: 'gold', shape: 'rect', label: 'paypal', height: 48 }
            : { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' }
        }
        createOrder={async () => {
          try {
            const requestData = {
              items: cartItems.map((item) => ({
                listingId: item.id,
                quantity: 1,
              })),
              shippingAddress,
              applyStoreCredit,
            };

            // Authentication is required
            const response = await api.authPost<{ orderId: string }>('/checkout/paypal/create', requestData);
            return response.orderId;
          } catch (err) {
            console.error('Failed to create PayPal order:', err);
            onError('Failed to create PayPal order. Please try again.');
            throw err;
          }
        }}
        onApprove={async (data) => {
          try {
            const captureData = {
              orderId: data.orderID,
            };

            // Authentication is required
            await api.authPost('/checkout/paypal/capture', captureData);
            onSuccess(data.orderID);
          } catch (err) {
            console.error('Failed to capture PayPal payment:', err);
            onError('Failed to complete PayPal payment. Please try again.');
          }
        }}
        onError={(err) => {
          console.error('PayPal error:', err);
          onError('PayPal encountered an error. Please try again.');
        }}
        onCancel={() => {
          onError('Payment was cancelled.');
        }}
      />
    </PayPalScriptProvider>
  );
}
