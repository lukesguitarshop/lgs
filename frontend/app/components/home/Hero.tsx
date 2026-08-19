import Link from 'next/link';
import type { ShopStats } from './shopStats';

interface HeroProps {
  stats: ShopStats;
}

/** One row of the rotated receipt card. */
function RecordRow({
  label,
  value,
  suffix,
  last = false,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-2.5 ${
        last ? '' : 'border-b border-dashed border-foreground/28 pb-[11px]'
      }`}
    >
      <dt className="label-mono-sm text-[10.5px] tracking-[0.13em] text-foreground/60">{label}</dt>
      <dd className="m-0 flex flex-col items-end gap-[3px] font-heading text-[30px] leading-none">
        {value}
        {suffix && (
          <span className="label-mono-sm text-[8px] tracking-[0.13em] text-foreground/60">
            {suffix}
          </span>
        )}
      </dd>
    </div>
  );
}

export default function Hero({ stats }: HeroProps) {
  return (
    <section
      id="top"
      className="mx-auto flex max-w-[1320px] flex-wrap items-start gap-[clamp(32px,5vw,72px)] px-5 pt-[clamp(44px,7vw,100px)] pb-[clamp(36px,5vw,64px)]"
    >
      <div className="min-w-0 flex-[1_1_460px]">
        <p className="label-mono mb-[clamp(20px,3vw,30px)] flex items-center gap-3 text-[11.5px] text-primary">
          <span className="inline-block h-px w-[34px] bg-primary" />
          One person. No warehouse.
        </p>

        <h1 className="font-heading text-[clamp(38px,7.2vw,80px)] leading-[0.94]">
          Used and vintage
          <br />
          guitars, priced to sell.
          <br />
          <span className="text-primary">Free shipping, always.</span>
        </h1>

        <p className="mt-[clamp(14px,1.8vw,20px)] max-w-[47ch] text-[clamp(16px,1.5vw,19px)] leading-[1.55] text-foreground/70">
          I&apos;m Luke, and I sell guitars out of Ohio — one at a time, no warehouse. You get 14 or
          15 photos of the exact guitar you&apos;re buying, never a stock photo, with the buckle
          rash and the fret wear right there in the frame instead of cropped out. Shipping&apos;s
          free and insured, always.
        </p>

        <div className="mt-[clamp(26px,3.5vw,36px)] flex flex-wrap items-center gap-3.5">
          <Link
            href="#inventory"
            className="btn-mono min-h-[52px] border border-primary bg-primary px-[26px] py-4 text-primary-foreground hover:border-foreground hover:bg-foreground cursor-pointer"
          >
            Browse what&apos;s in stock
          </Link>
          <Link
            href="/trade-in"
            className="inline-flex min-h-[52px] items-center border-b border-foreground/30 px-1 py-4 text-[15px] text-foreground/70 transition-colors hover:border-primary hover:text-primary cursor-pointer"
          >
            Or send me a trade-in
          </Link>
        </div>
      </div>

      {/* The record: a paper receipt, pinned slightly off-square. */}
      <div className="flex flex-[0_1_300px] justify-start pt-[clamp(8px,2vw,54px)]">
        <div className="receipt relative w-[clamp(230px,26vw,290px)] -rotate-2 pb-[22px]">
          <div className="receipt-rule" />
          <div className="flex justify-center pt-3.5 pb-1">
            <span className="block h-[15px] w-[15px] rounded-full bg-foreground" />
          </div>
          <p className="label-mono mt-2 mb-4 text-center text-[10px] tracking-[0.22em] text-primary">
            The record
          </p>
          <dl className="m-0 grid gap-3.5 px-[22px] font-mono">
            <RecordRow label="Sold" value={stats.soldCount} />
            {stats.averageRating !== null && (
              <RecordRow
                label="Rating"
                value={
                  <span>
                    {stats.averageRating} <span className="text-[15px] text-primary">★</span>
                  </span>
                }
              />
            )}
            <RecordRow label="Years" value={stats.years} />
            <RecordRow label="Listed across" value={stats.platforms} suffix="platforms" last />
          </dl>
        </div>
      </div>
    </section>
  );
}
