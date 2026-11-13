import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Anton, Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import DevBanner from "./components/DevBanner";
import MainShell from "./components/MainShell";
import ImpersonationBanner from "./components/ImpersonationBanner";
import { AuthProvider } from "@/contexts/AuthContext";
import { LoginModal } from "@/components/auth/LoginModal";
import { RegisterModal } from "@/components/auth/RegisterModal";
import { ToastProvider } from "@/components/ui/toast";
import GoogleAnalytics from "@/components/GoogleAnalytics";

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: ["400"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lukesguitarshop.com";

// viewport-fit=cover is what makes env(safe-area-inset-bottom) non-zero on notched
// phones; without it the sticky action bars sit under the home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const defaultTitle = "Luke's Guitar Shop | Used & Vintage Guitars, Free Shipping";
const defaultDescription =
  "Hand-picked used Fender, Gibson and PRS guitars from a one-person Ohio shop. 14+ photos of the exact guitar, every flaw disclosed, free insured shipping.";

// The favicon is not declared here: Next picks up app/favicon.ico, app/icon.png and
// app/apple-icon.png on its own. Declaring another one gives Google two to choose from.
export const metadata: Metadata = {
  title: {
    default: defaultTitle,
    template: "%s | Luke's Guitar Shop",
  },
  description: defaultDescription,
  applicationName: "Luke's Guitar Shop",
  authors: [{ name: "Luke's Guitar Shop" }],
  creator: "Luke's Guitar Shop",
  publisher: "Luke's Guitar Shop",
  metadataBase: new URL(siteUrl),
  // No canonical here: a canonical set in the root layout is inherited by every page,
  // which told Google that /sold, /shop-info and the rest were copies of the homepage.
  // Each indexable page declares its own.
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Luke's Guitar Shop",
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Luke's Guitar Shop — used and vintage guitars, free insured shipping",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/images/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "77g5ivAPDwSbUResEwBy0oprbZzovVuh77bh8EuTv7k",
  },
};

function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Luke's Guitar Shop",
    url: siteUrl,
    logo: `${siteUrl}/images/logo-square.png`,
    description: "Used and vintage guitars from a one-person shop in Ohio. Every flaw disclosed, free insured shipping.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "lukesguitarshop@gmail.com",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

function WebSiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Luke's Guitar Shop",
    alternateName: ["Lukes Guitar Shop", "lukesguitarshop.com"],
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

function LocalBusinessJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "Luke's Guitar Shop",
    url: siteUrl,
    logo: `${siteUrl}/images/logo-square.png`,
    description: "Used and vintage guitars from a one-person shop in Ohio. Every flaw disclosed, free insured shipping.",
    priceRange: "$$",
    image: `${siteUrl}/images/og-image.png`,
    email: "lukesguitarshop@gmail.com",
    paymentAccepted: ["Credit Card", "PayPal"],
    currenciesAccepted: "USD",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Guitars",
      itemListElement: [
        {
          "@type": "OfferCatalog",
          name: "Electric Guitars",
        },
        {
          "@type": "OfferCatalog",
          name: "Acoustic Guitars",
        },
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <LocalBusinessJsonLd />
      </head>
      <body
        className={`${anton.variable} ${archivo.variable} ${jetbrainsMono.variable} antialiased flex flex-col min-h-screen bg-background text-foreground`}
      >
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <DevBanner />
        <ToastProvider>
          <AuthProvider>
            <ImpersonationBanner />
            <Header />
            <MainShell>{children}</MainShell>
            <Footer />
            <LoginModal />
            <RegisterModal />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
