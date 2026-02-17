'use client';

import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
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
}: PayPalCheckoutButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!clientId) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
        <p className="text-sm font-medium text-red-700">PayPal not configured</p>
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-sm font-medium text-gray-500">Please fill in shipping address first</p>
      </div>
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
        style={{
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
        }}
        createOrder={async () => {
          try {
            const requestData = {
              items: cartItems.map((item) => ({
                listingId: item.id,
                quantity: 1,
              })),
              shippingAddress,
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
