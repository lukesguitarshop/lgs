import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ShopStats } from './shopStats';
import FeaturedGuitar, { type FeaturedListing } from './FeaturedGuitar';

interface HeroProps {
  stats: ShopStats;
  /** Null when nothing is featured, in which case the slot is simply omitted. */
  featured: FeaturedListing | null;
}

/** One row of the rotated receipt card. */
function RecordRow({
  label,
  value,
  suffix,
  last = false,
  compact = false,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  last?: boolean;
  /** Tightened up when the featured guitar shares the column. */
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-2.5 ${
        last ? '' : `border-b border-dashed border-foreground/28 ${compact ? 'pb-2' : 'pb-[11px]'}`
      }`}
    >
      <dt className="label-mono-sm text-[10.5px] tracking-[0.13em] text-foreground/60">{label}</dt>
      <dd
        className={`m-0 flex flex-col items-end gap-[3px] font-heading leading-none ${
          compact ? 'text-[23px]' : 'text-[30px]'
        }`}
      >
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

export default function Hero({ stats, featured }: HeroProps) {
  // The phone band is a 2×2 grid, so the rating cell has to be dropped from the list
  // rather than left blank when the reviews service is unreachable.
  const record: { label: string; value: React.ReactNode }[] = [
    { label: 'Sold', value: stats.soldCount },
    ...(stats.averageRating !== null ? [{ label: 'Rating', value: stats.averageRating }] : []),
    { label: 'Years', value: stats.years },
    { label: 'Platforms', value: stats.platforms },
  ];
  const dashed = 'border-dashed border-foreground/30';

  // The phone and desktop compositions share their two columns instead of living in
  // separate md:hidden / hidden md:flex blocks, because the featured guitar is the first
  // listing link on the page and the e2e suite clicks whichever `a[href*="/listing/"]`
  // comes first in the DOM — at 375px as well as at desktop width. Two copies would put
  // a hidden one first at one of those widths, so it is rendered once and each column
  // swaps only its copy or its record around it. From md up every class below restores
  // the pre-revamp desktop exactly.
  return (
    <section
      id="top"
      className="order-1 md:order-none md:mx-auto md:flex md:max-w-[1320px] md:flex-wrap md:items-start md:gap-[clamp(32px,5vw,72px)] md:px-5 md:pt-[clamp(44px,7vw,100px)] md:pb-[clamp(36px,5vw,64px)]"
    >
      <div className="min-w-0 md:flex-[1_1_460px]">
        <div className="hidden md:block">
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

        {/* Phone: the copy stacks over one full-width CTA. */}
        <div className="px-5 pt-7 pb-8 md:hidden">
          <p className="label-mono flex items-center gap-2 text-primary">
            <span className="block h-0.5 w-4 bg-primary" />
            One person. No warehouse.
          </p>

          <h1 className="mt-3.5 font-heading text-[clamp(32px,9.6vw,36px)] leading-[0.95] tracking-[0.004em] text-balance">
            Used and vintage guitars, priced to sell.{' '}
            <span className="text-primary">Free shipping, always.</span>
          </h1>

          {/* Proposed mobile alternate: the owner's own first sentence, shortened so the
              CTA clears the fold. Desktop keeps the full intro. Awaiting sign-off. */}
          <p className="mt-4 text-base leading-[1.5] text-pretty text-foreground/78">
            I&apos;m Luke. I sell guitars out of Ohio — one at a time, no warehouse.
          </p>

          <Link
            href="#inventory"
            className="font-btn mt-5 flex h-13 items-center justify-center bg-primary text-[13px] text-primary-foreground"
          >
            Browse what&apos;s in stock
          </Link>
          <Link
            href="/trade-in"
            className="mt-3.5 flex min-h-11 items-center justify-center text-sm underline underline-offset-4"
          >
            Or send me a trade-in →
          </Link>
        </div>
      </div>

      {/* The record, then the featured guitar beneath it. Both are built to the same
          narrow width so the column reads as one stack. */}
      <div className="md:flex md:flex-[0_1_300px] md:flex-col md:items-start md:gap-5 md:pt-[clamp(8px,2vw,54px)]">
        <div className={`receipt relative hidden w-[clamp(230px,26vw,290px)] -rotate-2 md:block ${featured ? 'pb-4' : 'pb-[22px]'}`}>
          <div className="receipt-rule" />
          <div className="flex justify-center pt-2.5 pb-1">
            <span className="block h-3 w-3 rounded-full bg-foreground" />
          </div>
          <p className="label-mono mt-1.5 mb-3 text-center text-[10px] tracking-[0.22em] text-primary">
            The record
          </p>
          <dl className={`m-0 grid px-[22px] font-mono ${featured ? 'gap-2.5' : 'gap-3.5'}`}>
            <RecordRow label="Sold" value={stats.soldCount} compact={!!featured} />
            {stats.averageRating !== null && (
              <RecordRow
                label="Rating"
                compact={!!featured}
                value={
                  <span>
                    {stats.averageRating} <span className="text-[15px] text-primary">★</span>
                  </span>
                }
              />
            )}
            <RecordRow label="Years" value={stats.years} compact={!!featured} />
            <RecordRow
              label="Listed across"
              value={stats.platforms}
              suffix="platforms"
              last
              compact={!!featured}
            />
          </dl>
        </div>

        {/* Phone: the record is a full-width band under the copy instead of a rotated
            card beside it. */}
        <div className="relative mx-5 mb-8 border border-foreground/20 border-t-4 border-t-primary bg-background md:hidden">
          <span
            aria-hidden
            className="absolute top-3.5 right-3.5 h-3 w-3 rounded-full border border-foreground/25 bg-muted"
          />
          <p className="label-mono px-5 pt-4 pb-3">The record</p>
          <dl className={cn('m-0 grid grid-cols-2 border-t-[1.5px]', dashed)}>
            {record.map((stat, i) => (
              <div
                key={stat.label}
                className={cn(
                  'flex flex-col-reverse px-5 py-4',
                  dashed,
                  i % 2 === 0 && 'border-r-[1.5px]',
                  i >= 2 && 'border-t-[1.5px]'
                )}
              >
                <dt className="label-mono mt-1 text-foreground/60">{stat.label}</dt>
                <dd className="m-0 font-heading text-[32px] leading-none">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {featured && (
          <div className="mx-5 mb-8 md:mx-0 md:mb-0 md:w-[clamp(230px,26vw,290px)]">
            <FeaturedGuitar listing={featured} />
          </div>
        )}
      </div>
    </section>
  );
}
