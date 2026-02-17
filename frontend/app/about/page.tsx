import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">About Luke's Guitar Shop</h1>

        <div className="prose prose-lg dark:prose-invert">
          <p className="text-muted-foreground mb-6">
            Luke's Guitar Shop was founded in 2022 by Luke Walden, a guitar enthusiast turned full-time dealer with a passion for connecting players with quality pre-owned instruments.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Our Story</h2>
          <p className="text-muted-foreground mb-6">
            What started as a love for guitars has grown into a thriving online business dedicated to buying, selling, and trading used guitars. While we operate exclusively online for now, the dream of opening a physical storefront one day keeps us motivated and growing.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">What We Offer</h2>
          <p className="text-muted-foreground mb-6">
            We specialize in pre-owned guitars, with a carefully curated selection that changes regularly. You'll also find amps, parts, and accessories listed from time to time. Every instrument is inspected and honestly described so you know exactly what you're getting.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Where to Find Us</h2>
          <p className="text-muted-foreground mb-6">
            You can find our listings on Reverb, eBay, Sweetwater Gear Exchange, and Facebook Marketplace—but your best price will always be right here on our shop page. We cut out the middleman fees and pass those savings directly to you.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Easy, Secure Checkout</h2>
          <p className="text-muted-foreground mb-6">
            Creating an account is quick and easy—just enter your email and you're ready to go. All payments are securely processed through Stripe or PayPal. Need a payment plan? PayPal Pay Later makes it easy to spread out your purchase.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Our Promise</h2>
          <p className="text-muted-foreground mb-6">
            Every purchase from Luke's Guitar Shop includes free shipping, fully covered by us. We believe in making the buying process as smooth and affordable as possible, so you can focus on what matters: finding your next great instrument.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Get in Touch</h2>
          <p className="text-muted-foreground mb-6">
            Have questions about a listing or looking for something specific?{' '}
            <Link href="/contact" className="text-[#df5e15] hover:text-[#c74d12] underline">
              Contact us
            </Link>
            {' '}anytime. We're always happy to help.
          </p>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: "About | Luke's Guitar Shop",
  description: 'Learn more about Luke\'s Guitar Shop - quality pre-owned guitars since 2022.',
};
