'use client';

import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">Luke's Guitar Shop</h1>

        <Tabs defaultValue="about" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="return-policy">Return Policy</TabsTrigger>
          </TabsList>

          <TabsContent value="about">
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
          </TabsContent>

          <TabsContent value="return-policy">
            <div className="prose prose-lg dark:prose-invert">
              <h2 className="text-2xl font-semibold mb-6">Return Policy</h2>

              <ul className="space-y-4 text-muted-foreground list-none pl-0">
                <li className="flex items-start gap-3">
                  <span className="text-[#df5e15] font-bold">1.</span>
                  <span>Item isn't sold until payment clears.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#df5e15] font-bold">2.</span>
                  <span>Check all photos carefully before buying. Need more pics? Just ask.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#df5e15] font-bold">3.</span>
                  <span>Sold as-is, all sales final. That said, you have 24 hours from delivery to request a return if needed. Approved returns have a 15% restocking fee, must be in original condition with all packaging, and you cover return shipping with full insurance.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#df5e15] font-bold">4.</span>
                  <span>You're buying a used guitar, not a fresh setup—plan to adjust it yourself.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#df5e15] font-bold">5.</span>
                  <span>Questions? Message me anytime.</span>
                </li>
              </ul>

              <div className="mt-8 p-4 bg-muted rounded-lg">
                <p className="text-muted-foreground text-sm">
                  Have questions about a specific item or need to request a return?{' '}
                  <Link href="/contact" className="text-[#df5e15] hover:text-[#c74d12] underline">
                    Contact us
                  </Link>
                  {' '}and we'll get back to you as soon as possible.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
