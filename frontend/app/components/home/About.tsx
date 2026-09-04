import Image from 'next/image';
import Link from 'next/link';
import type { ShopStats } from './shopStats';

interface AboutProps {
  stats: ShopStats;
}

export default function About({ stats }: AboutProps) {
  return (
    <section id="about" className="order-3 md:order-none md:bg-foreground md:text-background">
      {/* Phone: cream, not the navy band — a full-height navy block at 375px read as a
          second footer. The photo goes edge to edge and the bio folds into a <details>
          so the sold strip is one swipe away, not four paragraphs. */}
      <div className="pt-8 md:hidden">
        <h2 className="px-5 font-heading text-[26px] leading-none">Who you&apos;re buying from</h2>

        <div className="relative mt-4 aspect-[4/5] w-full border-y border-foreground/12">
          <Image
            src="/images/luke.png"
            alt="Luke, owner of Luke's Guitar Shop"
            fill
            sizes="100vw"
            className="object-cover saturate-[0.85]"
          />
        </div>
        <p className="label-mono-sm mt-2 px-5 text-foreground/60">Luke · owner, packer, photographer</p>

        <div className="px-5 pt-5">
          <h3 className="text-[18px] font-semibold leading-[1.25]">I sell what I&apos;d keep.</h3>
          <p className="mt-3 text-base leading-[1.5] text-foreground/78">
            I&apos;m Luke — born and raised in Columbus, Ohio. Ten years of guitar experience and
            going on five in the industry. I play all sorts of genres, and my main player is a
            Kiesel Delos I had custom built, so don&apos;t be surprised to see used Kiesels come
            through here.
          </p>

          <details className="group">
            <summary className="flex h-12 cursor-pointer list-none items-center text-sm text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Read the whole story →</span>
              <span className="hidden group-open:inline">Show less</span>
            </summary>
            <div className="grid gap-4 pb-2 text-base leading-[1.5] text-foreground/78">
              <p>
                There&apos;s no team. I find the guitars, I photograph them, I answer your questions,
                I pack the box. {stats.soldCount} rehomed guitars and counting
                {stats.averageRating !== null &&
                  `, ${stats.averageRating} stars across every platform I sell on`}
                . If I wouldn&apos;t play it, I don&apos;t list it.
              </p>
              <p>
                The listing tells you the truth before you spend the money: 14 or 15 photos, the wear
                described in plain words, the case situation stated. If something&apos;s marked Very
                Good, the photos show you exactly why it isn&apos;t Excellent.
              </p>
              <p>
                Ask me anything before you buy. I&apos;d rather answer ten questions upfront than sort
                out a misunderstanding after the sale, and I&apos;ll shoot you a video or a clip of the
                guitar if that&apos;s what it takes.
              </p>
            </div>
          </details>

          <div className="mt-3 flex flex-col gap-2">
            <a
              href="mailto:lukesguitarshop@gmail.com"
              className="font-btn flex h-12 items-center justify-center border border-foreground text-[13px] text-foreground"
            >
              Email me a question
            </a>
            <Link
              href="/sold"
              className="flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
            >
              See what I&apos;ve sold
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto hidden max-w-[1320px] flex-wrap items-start gap-[clamp(30px,4.5vw,64px)] px-5 py-[clamp(48px,6vw,88px)] md:flex">
        <div className="max-w-[400px] flex-[1_1_280px]">
          <Image
            src="/images/luke.png"
            alt="Luke, owner of Luke's Guitar Shop"
            width={1365}
            height={1366}
            sizes="(max-width: 768px) 100vw, 400px"
            className="block aspect-square w-full border border-background/20 object-cover saturate-[0.85]"
          />
          <p className="label-mono-sm mt-3 text-muted-foreground">
            Luke · owner, packer, photographer
          </p>
        </div>

        <div className="min-w-0 flex-[1_1_420px]">
          <p className="label-mono mb-[clamp(18px,2.5vw,26px)] text-muted-foreground">
            Who you&apos;re buying from
          </p>
          <h2 className="font-heading text-[clamp(30px,4.6vw,52px)]">
            I sell what
            <br />
            I&apos;d keep.
          </h2>

          <div className="mt-[clamp(20px,2.6vw,28px)] grid max-w-[56ch] gap-4 text-[clamp(16px,1.5vw,18px)] leading-[1.6] text-muted-foreground">
            <p>
              I&apos;m Luke — born and raised in Columbus, Ohio. Ten years of guitar experience and
              going on five in the industry. I play all sorts of genres, and my main player is a
              Kiesel Delos I had custom built, so don&apos;t be surprised to see used Kiesels come
              through here.
            </p>
            <p>
              There&apos;s no team. I find the guitars, I photograph them, I answer your questions,
              I pack the box. {stats.soldCount} rehomed guitars and counting
              {stats.averageRating !== null &&
                `, ${stats.averageRating} stars across every platform I sell on`}
              . If I wouldn&apos;t play it, I don&apos;t list it.
            </p>
            <p>
              The listing tells you the truth before you spend the money: 14 or 15 photos, the wear
              described in plain words, the case situation stated. If something&apos;s marked Very
              Good, the photos show you exactly why it isn&apos;t Excellent.
            </p>
            <p>
              Ask me anything before you buy. I&apos;d rather answer ten questions upfront than sort
              out a misunderstanding after the sale, and I&apos;ll shoot you a video or a clip of the
              guitar if that&apos;s what it takes.
            </p>
          </div>

          <div className="mt-[clamp(24px,3vw,34px)] flex flex-wrap items-center gap-3.5">
            <a
              href="mailto:lukesguitarshop@gmail.com"
              className="btn-mono min-h-[50px] bg-background px-6 py-[15px] text-[12px] text-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer"
            >
              Email me a question
            </a>
            <Link
              href="/sold"
              className="inline-flex min-h-[44px] items-center border-b border-muted-foreground/45 pb-0.5 text-[15px] text-muted-foreground transition-colors hover:border-background hover:text-background cursor-pointer"
            >
              See what I&apos;ve sold
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
