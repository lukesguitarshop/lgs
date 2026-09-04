import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Clock, Shield, Zap } from 'lucide-react';

export const metadata = { title: 'Trade in your guitar' };

const promises = [
  {
    icon: Clock,
    head: '24 hour quote',
    body: 'We review your photos and send two offers within a day.',
  },
  {
    icon: Shield,
    head: 'Trusted shop',
    body: 'Hundreds of guitars sold on Reverb and eBay with 5-star feedback.',
  },
  {
    icon: Zap,
    head: 'Higher with credit',
    body: 'Pick cash or take a higher offer in store credit.',
  },
];

const steps = [
  {
    head: 'Submit your guitar',
    body: 'Tell us the brand, model, and condition. Upload a few photos from your phone.',
  },
  {
    head: 'Pick your offer',
    body: "We'll email you two offers — cash or a higher amount in store credit. You choose.",
  },
  {
    head: 'Ship for free',
    body: 'We send a prepaid label. You ship. We pay (or credit) you after inspection.',
  },
];

export default function TradeInLandingPage() {
  return (
    <>
      {/* Mobile: one column, Anton heading, numbered rows in the homepage terms pattern. */}
      <div className="px-5 py-8 md:hidden">
        <p className="label-mono flex items-center gap-3 text-primary">
          <span aria-hidden className="block h-0.5 w-4 bg-primary" />
          Cash or store credit
        </p>
        <h1 className="font-heading mt-4 text-[clamp(32px,9.6vw,36px)] leading-[0.95]">
          Trade in your guitar
        </h1>
        <p className="mt-3 text-base leading-[1.5] text-foreground/78">
          Send photos and what you want for it. You get a quote within 24 hours, and a
          prepaid label if you take it.
        </p>

        <Link
          href="/trade-in/submit"
          className="font-btn mt-6 flex h-13 w-full items-center justify-center bg-primary text-[13px] text-primary-foreground"
        >
          Start trade-in
        </Link>

        <ol className="m-0 mt-8 list-none border-t border-foreground/15 p-0">
          {steps.map((step, i) => (
            <li
              key={step.head}
              className="grid grid-cols-[auto_1fr] gap-3.5 border-b border-foreground/12 py-4"
            >
              <span className="font-heading text-[15px] leading-none text-primary">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="text-base leading-[1.3] font-semibold">{step.head}</p>
                <p className="mt-1 text-sm leading-[1.45] text-foreground/65">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 border-t border-foreground/15">
          {promises.map(({ icon: Icon, head, body }) => (
            <div key={head} className="flex gap-3.5 border-b border-foreground/12 py-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-base leading-[1.3] font-semibold">{head}</p>
                <p className="mt-1 text-sm leading-[1.45] text-foreground/65">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: unchanged. */}
      <div className="mx-auto hidden max-w-4xl px-4 md:block">
        <div className="py-16 text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
            Trade in your guitar online
          </h1>
          <p className="mb-8 text-xl text-foreground/70">Get a quote within 24 hours</p>
          <Link href="/trade-in/submit">
            <Button className="bg-primary px-8 py-6 text-lg font-semibold text-primary-foreground hover:bg-primary/90">
              Start Trade-In
            </Button>
          </Link>
        </div>

        <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {promises.map(({ icon: Icon, head, body }) => (
            <div key={head} className="border border-foreground/15 bg-background p-6 text-center">
              <Icon className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h3 className="mb-2 font-semibold text-foreground">{head}</h3>
              <p className="text-sm text-foreground/70">{body}</p>
            </div>
          ))}
        </div>

        <div className="mb-16 border border-foreground/15 bg-background p-8">
          <h2 className="mb-6 text-center text-2xl font-bold text-foreground">How it works</h2>
          <ol className="mx-auto max-w-2xl space-y-6">
            {steps.map((step, i) => (
              <li key={step.head} className="flex gap-4">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-primary font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">{step.head}</h3>
                  <p className="text-foreground/70">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="pb-16 text-center">
          <Link href="/trade-in/submit">
            <Button className="bg-primary px-8 py-6 text-lg font-semibold text-primary-foreground hover:bg-primary/90">
              Start Trade-In
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
