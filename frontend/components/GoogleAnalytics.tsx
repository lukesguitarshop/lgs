'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  // Initialize GA4 on mount by injecting scripts into DOM directly
  useEffect(() => {
    if (!GA_ID || initialized.current) return;
    initialized.current = true;

    // Define gtag globally BEFORE loading the library
    window.dataLayer = window.dataLayer || [];
    // Use a proper function declaration so `arguments` object is available
    // GA4 specifically requires the Arguments object, not a regular array
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    } as Window['gtag'];
    window.gtag!('js', new Date());
    window.gtag!('config', GA_ID);

    // Dynamically create and append the gtag.js script element
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Track page views on every client-side navigation
  useEffect(() => {
    if (!GA_ID || !window.gtag) return;
    const url =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    window.gtag('event', 'page_view', {
      page_path: url,
      page_location: window.location.href,
    });
  }, [pathname, searchParams]);

  return null;
}
