'use client';

import { useEffect } from 'react';

/**
 * Google Customer Reviews opt-in for the order confirmation page. After a purchase
 * Google asks the buyer whether it may email them a short survey once the guitar has
 * arrived; the answers become the seller star rating shown on the shop's listings.
 *
 * OFF until the Google Customer Reviews agreement is signed in Merchant Center
 * (Reviews > Google Customer Reviews > Sign agreement). Flip ENABLED to true once it
 * is; before that the program is not active and there is nothing for this to show.
 */
const ENABLED = false;

const MERCHANT_ID = 5728946069;
/**
 * Days from order to delivery that Google waits before sending the survey. Merchant
 * Center promises 2-3 business days; a few more keeps the survey from arriving
 * before the guitar does when a weekend or holiday falls in between.
 */
const DAYS_UNTIL_SURVEY = 6;

interface SurveyOptIn {
  merchant_id: number;
  order_id: string;
  email: string;
  delivery_country: string;
  estimated_delivery_date: string;
}

declare global {
  interface Window {
    renderOptIn?: () => void;
    gapi?: {
      load: (name: string, callback: () => void) => void;
      surveyoptin?: { render: (options: SurveyOptIn) => void };
    };
  }
}

/** Google wants a two-letter country code; the shop stores whatever the buyer typed. */
export function countryCode(country: string | null | undefined): string | null {
  const value = (country ?? '').trim();
  if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  if (/^(united states|united states of america|usa)$/i.test(value)) return 'US';
  return null;
}

export function estimatedDeliveryDate(from: Date, days = DAYS_UNTIL_SURVEY): string {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function GoogleCustomerReviews({
  orderId,
  email,
  country,
}: {
  orderId: string | null;
  email: string | null | undefined;
  country: string | null | undefined;
}) {
  const deliveryCountry = countryCode(country);

  useEffect(() => {
    if (!ENABLED || !orderId || !email || !deliveryCountry) return;

    window.renderOptIn = () => {
      window.gapi?.load('surveyoptin', () => {
        window.gapi?.surveyoptin?.render({
          merchant_id: MERCHANT_ID,
          order_id: orderId,
          email,
          delivery_country: deliveryCountry,
          estimated_delivery_date: estimatedDeliveryDate(new Date()),
        });
      });
    };

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/platform.js?onload=renderOptIn';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
      delete window.renderOptIn;
    };
  }, [orderId, email, deliveryCountry]);

  return null;
}
