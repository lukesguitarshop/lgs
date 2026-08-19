import Link from 'next/link';

const terms = [
  {
    head: 'Payment clears first',
    body: "Nothing is reserved or sold until payment has fully cleared. Pending or unverified payments don't hold an instrument.",
  },
  {
    head: 'Look before you buy',
    body: 'Review every photo and the full description. More photos, measurements, or details on request — ask before you buy, not after.',
  },
  {
    head: 'Sold as-is, all sales final',
    body: "Cancellations aren't accepted once payment clears. A 15% restocking fee applies to any cancelled order, because packing starts immediately.",
  },
  {
    head: 'Returns by approval, 24 hours',
    body: 'Requested within 24 hours of delivery. 15% restocking fee, original packing and accessories, buyer-paid insured return with signature. Refunded after inspection.',
  },
  {
    head: "It's a used instrument",
    body: 'Not a professionally set-up guitar. I do a basic setup so it plays out of the box; minor intonation, action, and tuning adjustments are expected and are yours to make.',
  },
  {
    head: 'Store credit is final',
    body: "Guitars bought with store credit aren't eligible for return under any circumstances.",
  },
];

export default function TermsGrid() {
  return (
    <section id="terms" className="border-t border-foreground/14">
      <div className="mx-auto max-w-[1320px] px-5 py-[clamp(44px,5.5vw,76px)]">
        <div className="flex flex-wrap items-start gap-[clamp(24px,4vw,64px)]">
          <div className="flex-[1_1_260px]">
            <h2 className="font-heading text-[clamp(26px,3.4vw,38px)] leading-[0.98]">
              Read this before
              <br />
              you buy
            </h2>
            <p className="mt-3.5 text-[15px] leading-[1.55] text-foreground/68">
              These are strict on purpose. Ask me everything first — questions before the sale are
              free.
            </p>
            <Link
              href="/shop-info"
              className="label-mono-sm mt-4 inline-block tracking-[0.12em] text-primary underline-offset-4 hover:underline cursor-pointer"
            >
              Full terms on Shop Info →
            </Link>
          </div>

          <div className="grid min-w-0 flex-[999_1_460px] grid-cols-[repeat(auto-fit,minmax(258px,1fr))] gap-px border border-foreground/14 bg-foreground/14">
            {terms.map(term => (
              <div key={term.head} className="bg-background px-[19px] pt-[19px] pb-[21px]">
                <p className="label-mono-sm mb-2 tracking-[0.16em] text-foreground">{term.head}</p>
                <p className="text-[13.5px] leading-[1.55] text-foreground/68">{term.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
