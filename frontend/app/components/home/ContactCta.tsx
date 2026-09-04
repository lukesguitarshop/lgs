import Link from 'next/link';

const socials = [
  {
    label: 'Instagram',
    handle: '@lukesguitarshop_oh',
    href: 'https://www.instagram.com/lukesguitarshop_oh/',
  },
  {
    label: 'TikTok',
    handle: '@lukesguitarshop',
    href: 'https://www.tiktok.com/@lukesguitarshop',
  },
  {
    label: 'YouTube',
    handle: 'lukesguitarshop',
    href: 'https://www.youtube.com/@lukesguitarshop',
  },
  {
    label: 'Facebook',
    handle: "Luke's Guitar Shop",
    // The canonical form the profile.php?id=… link redirects to.
    href: 'https://www.facebook.com/people/Lukes-Guitar-Shop/61577543285201/',
  },
];

export default function ContactCta() {
  // The 32px gap above the band sits on the section, not inside it: the section is a
  // flex item on phones, so a child margin would paint crimson instead of cream.
  return (
    <section
      id="trade"
      className="order-7 mt-8 bg-primary text-primary-foreground md:order-none md:mt-0"
    >
      {/* Phone: one cream CTA to the contact page, the trade-in and mailto kept as rows
          beneath so nothing the desktop band links to goes missing. */}
      <div className="px-5 py-8 md:hidden">
        <h2 className="font-heading text-[26px] leading-none">Tell me what you&apos;re hunting for.</h2>
        <p className="mt-3 text-base leading-[1.5] text-primary-foreground/85">
          A specific year, a specific finish, a neck profile you can&apos;t do without — send it
          and I&apos;ll watch for it. Same if you&apos;ve got something to trade or sell: photos
          and your number, and I&apos;ll come back with a real answer.
        </p>
        <Link
          href="/contact"
          className="font-btn mt-5 flex h-13 items-center justify-center bg-background text-[13px] text-primary"
        >
          Message Luke
        </Link>
        <Link
          href="/trade-in"
          className="mt-3 flex min-h-11 items-center justify-center text-sm text-primary-foreground/85 underline underline-offset-4"
        >
          Or start a trade-in →
        </Link>

        <p className="label-mono mt-6 text-primary-foreground/75">See the guitars on video</p>
        <ul className="m-0 mt-3 list-none border-t border-primary-foreground/28 p-0">
          {socials.map(social => (
            <li key={social.label}>
              <a
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center justify-between gap-3 border-b border-primary-foreground/28 text-[15px] text-primary-foreground"
              >
                {social.label}
                <span className="font-mono text-[11px] text-primary-foreground/72">
                  {social.handle}
                </span>
              </a>
            </li>
          ))}
          <li>
            <a
              href="mailto:lukesguitarshop@gmail.com"
              className="flex h-12 items-center border-b border-primary-foreground/28 text-[15px] text-primary-foreground"
            >
              lukesguitarshop@gmail.com
            </a>
          </li>
        </ul>
      </div>

      <div className="mx-auto hidden max-w-[1320px] flex-wrap items-start gap-[clamp(30px,5vw,72px)] px-5 py-[clamp(52px,7vw,96px)] md:flex">
        <div className="min-w-0 flex-[1_1_440px]">
          <h2 className="font-heading text-[clamp(34px,6vw,72px)] leading-[0.93]">
            Tell me what
            <br />
            you&apos;re hunting for.
          </h2>
          <p className="mt-[clamp(20px,2.6vw,28px)] max-w-[48ch] text-[clamp(16px,1.5vw,18.5px)] leading-[1.6] text-primary-foreground/82">
            A specific year, a specific finish, a neck profile you can&apos;t do without — send it
            and I&apos;ll watch for it. Same if you&apos;ve got something to trade or sell: photos
            and your number, and I&apos;ll come back with a real answer.
          </p>
          <div className="mt-[clamp(24px,3vw,34px)] flex flex-wrap items-center gap-3.5">
            <Link
              href="/trade-in"
              className="btn-mono min-h-[54px] border border-primary-foreground bg-primary-foreground px-7 py-[17px] text-foreground hover:border-foreground hover:bg-foreground hover:text-primary-foreground cursor-pointer"
            >
              Start a trade-in
            </Link>
            <a
              href="mailto:lukesguitarshop@gmail.com"
              className="inline-flex min-h-[54px] items-center border-b border-primary-foreground/45 px-1 py-[17px] text-[15px] text-primary-foreground/80 transition-colors hover:border-primary-foreground hover:text-primary-foreground cursor-pointer"
            >
              lukesguitarshop@gmail.com
            </a>
          </div>
        </div>

        <div className="min-w-0 flex-[1_1_260px]">
          <p className="label-mono mb-4 text-[10.5px] tracking-[0.18em] text-primary-foreground/75">
            See the guitars on video
          </p>
          <ul className="m-0 grid list-none gap-0 border-t border-primary-foreground/28 p-0">
            {socials.map(social => (
              <li key={social.label}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[50px] items-center justify-between gap-3 border-b border-primary-foreground/28 py-[15px] text-[15px] text-primary-foreground transition-colors hover:text-foreground cursor-pointer"
                >
                  {social.label}
                  <span className="font-mono text-[11px] text-primary-foreground/72">
                    {social.handle}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
