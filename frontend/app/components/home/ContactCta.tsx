import Link from 'next/link';

/** The mockup's Facebook entry pointed at a bare facebook.com placeholder, so it is left out. */
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
];

export default function ContactCta() {
  return (
    <section id="trade" className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-start gap-[clamp(30px,5vw,72px)] px-5 py-[clamp(52px,7vw,96px)]">
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
