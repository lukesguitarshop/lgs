import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Clock, Shield, Zap } from 'lucide-react';

export const metadata = { title: 'Trade in your guitar — Luke\'s Guitar Shop' };

export default function TradeInLandingPage() {
  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="text-center py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-[#020E1C] mb-4">
          Trade in your guitar online
        </h1>
        <p className="text-xl text-gray-600 mb-8">Get a quote within 24 hours</p>
        <Link href="/trade-in/submit">
          <Button className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold px-8 py-6 text-lg">
            Start Trade-In
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6 text-center">
          <Clock className="h-10 w-10 mx-auto text-[#6E0114] mb-3" />
          <h3 className="font-semibold text-[#020E1C] mb-2">24 hour quote</h3>
          <p className="text-gray-600 text-sm">We review your photos and send two offers within a day.</p>
        </div>
        <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6 text-center">
          <Shield className="h-10 w-10 mx-auto text-[#6E0114] mb-3" />
          <h3 className="font-semibold text-[#020E1C] mb-2">Trusted shop</h3>
          <p className="text-gray-600 text-sm">Hundreds of guitars sold on Reverb and eBay with 5-star feedback.</p>
        </div>
        <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6 text-center">
          <Zap className="h-10 w-10 mx-auto text-[#6E0114] mb-3" />
          <h3 className="font-semibold text-[#020E1C] mb-2">Higher with credit</h3>
          <p className="text-gray-600 text-sm">Pick cash or take a higher offer in store credit.</p>
        </div>
      </div>

      <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-8 mb-16">
        <h2 className="text-2xl font-bold text-[#020E1C] mb-6 text-center">How it works</h2>
        <ol className="space-y-6 max-w-2xl mx-auto">
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#6E0114] text-white flex items-center justify-center font-bold">1</span>
            <div>
              <h3 className="font-semibold text-[#020E1C]">Submit your guitar</h3>
              <p className="text-gray-600">Tell us the brand, model, and condition. Upload a few photos from your phone.</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#6E0114] text-white flex items-center justify-center font-bold">2</span>
            <div>
              <h3 className="font-semibold text-[#020E1C]">Pick your offer</h3>
              <p className="text-gray-600">We'll email you two offers — cash or a higher amount in store credit. You choose.</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#6E0114] text-white flex items-center justify-center font-bold">3</span>
            <div>
              <h3 className="font-semibold text-[#020E1C]">Ship for free</h3>
              <p className="text-gray-600">We send a prepaid label. You ship. We pay (or credit) you after inspection.</p>
            </div>
          </li>
        </ol>
      </div>

      <div className="text-center pb-16">
        <Link href="/trade-in/submit">
          <Button className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold px-8 py-6 text-lg">
            Start Trade-In
          </Button>
        </Link>
      </div>
    </div>
  );
}
