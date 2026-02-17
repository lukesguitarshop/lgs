import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import DevBanner from "./components/DevBanner";
import { AuthProvider } from "@/contexts/AuthContext";
import { LoginModal } from "@/components/auth/LoginModal";
import { RegisterModal } from "@/components/auth/RegisterModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lukesguitarshop.com";

export const metadata: Metadata = {
  title: {
    default: "Luke's Guitar Shop | Quality Guitars at Great Prices",
    template: "%s | Luke's Guitar Shop",
  },
  description: "Shop quality new and used guitars at Luke's Guitar Shop. Free shipping on all orders. Fender, Gibson, Martin, Taylor, and more.",
  keywords: ["guitar", "guitars", "used guitars", "guitar shop", "buy guitar", "Fender", "Gibson", "Martin", "Taylor", "electric guitar", "acoustic guitar"],
  authors: [{ name: "Luke's Guitar Shop" }],
  creator: "Luke's Guitar Shop",
  publisher: "Luke's Guitar Shop",
  icons: {
    icon: "/images/logo-transparent.png",
  },
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Luke's Guitar Shop",
    title: "Luke's Guitar Shop | Quality Guitars at Great Prices",
    description: "Shop quality new and used guitars at Luke's Guitar Shop. Free shipping on all orders.",
    images: [
      {
        url: "/images/logo-transparent.png",
        width: 1200,
        height: 630,
        alt: "Luke's Guitar Shop",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Luke's Guitar Shop | Quality Guitars at Great Prices",
    description: "Shop quality new and used guitars at Luke's Guitar Shop. Free shipping on all orders.",
    images: ["/images/logo-transparent.png"],
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
    logo: `${siteUrl}/images/logo-transparent.png`,
    description: "Quality new and used guitars at great prices. Free shipping on all orders.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "lukesguitarshop@gmail.com",
    },
    sameAs: [],
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
    logo: `${siteUrl}/images/logo-transparent.png`,
    description: "Quality new and used guitars at great prices. Free shipping on all orders.",
    priceRange: "$$",
    image: `${siteUrl}/images/logo-transparent.png`,
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-background text-foreground`}
      >
        <DevBanner />
        <AuthProvider>
          <Header />
          <main className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>
          <Footer />
          <LoginModal />
          <RegisterModal />
        </AuthProvider>
      </body>
    </html>
  );
}