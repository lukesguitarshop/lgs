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
    <section id="terms" className="order-6 md:order-none">
      {/* Phone: the same numbered-row pattern as the trust list. The bordered cell grid
          only works when at least two cells share a row. */}
      <div className="px-5 pt-8 md:hidden">
        <h2 className="font-heading text-[26px] leading-none">Read this before you buy</h2>
        <p className="mt-3 text-[15px] leading-[1.5] text-foreground/68">
          These are strict on purpose. Ask me everything first — questions before the sale are
          free.
        </p>
        <ol className="m-0 mt-4 list-none border-t border-foreground/15 p-0">
          {terms.map((term, i) => (
            <li
              key={term.head}
              className="grid grid-cols-[auto_1fr] gap-3.5 border-b border-foreground/12 py-4"
            >
              <span className="font-heading text-[15px] leading-none text-primary">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="text-base font-semibold leading-[1.3]">{term.head}</p>
                <p className="mt-1 text-sm leading-[1.45] text-foreground/65">{term.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link
          href="/shop-info"
          className="label-mono-sm mt-3 flex min-h-11 items-center tracking-[0.12em] text-primary"
        >
          Full terms on Shop Info →
        </Link>
      </div>

      <div className="hidden border-t border-foreground/14 md:block">
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

            {/* Dividers are drawn as cell borders, not as a 1px grid gap: fractional
                auto-fit column widths let a gap-painted line fall between device
                pixels and disappear. The negative margins push the trailing right
                and bottom borders under the wrapper's own border, which clips them. */}
            <div className="min-w-0 flex-[999_1_460px] overflow-hidden border border-foreground/14">
              <div className="-mr-px -mb-px grid grid-cols-[repeat(auto-fit,minmax(258px,1fr))]">
                {terms.map(term => (
                  <div
                    key={term.head}
                    className="border-r border-b border-foreground/14 bg-background px-[19px] pt-[19px] pb-[21px]"
                  >
                    <p className="label-mono-sm mb-2 tracking-[0.16em] text-foreground">{term.head}</p>
                    <p className="text-[13.5px] leading-[1.55] text-foreground/68">{term.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
