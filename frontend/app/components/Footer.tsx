import Link from 'next/link';

const footerLinks = [
  { href: '/', label: 'Home' },
  { href: '/#inventory', label: 'Listings' },
  { href: '/#about', label: 'About' },
  { href: '/shop-info', label: 'Shop info' },
  { href: '/sold', label: 'Sold' },
];

const mobileRowClass =
  'flex h-12 items-center border-b border-background/12 text-[15px] text-background transition-colors hover:text-muted-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring';

export default function Footer() {
  const year = new Date().getFullYear();

  // The crimson top rule belongs to the cream desktop footer; the phone footer is a
  // solid navy band and paints its own edge.
  return (
    <footer className="mt-auto border-primary md:border-t">
      {/* Mobile: navy band, 48px link rows */}
      <div className="bg-foreground px-5 pt-7 pb-6 text-background md:hidden">
        <p className="font-heading text-[22px]">Luke&apos;s Guitar Shop</p>
        <p className="label-mono mt-1.5 text-muted-foreground">
          Ohio · PayPal &amp; credit card · free insured shipping
        </p>

        <nav className="mt-[22px] border-t border-background/18">
          {footerLinks.map(link => (
            <Link key={link.href} href={link.href} className={mobileRowClass}>
              {link.label}
            </Link>
          ))}
          <a href="mailto:lukesguitarshop@gmail.com" className={mobileRowClass}>
            Contact
          </a>
        </nav>

        <p className="mt-5 text-[13px] leading-[1.5] text-background/55">
          © {year} Luke&apos;s Guitar Shop
        </p>
      </div>

      {/* Desktop: unchanged */}
      <div className="mx-auto hidden max-w-[1320px] flex-wrap items-end justify-between gap-6 px-5 pt-[34px] pb-11 md:flex">
        <div>
          <p className="font-heading text-xl tracking-[0.02em]">Luke&apos;s Guitar Shop</p>
          <p className="label-mono-sm mt-[7px] tracking-[0.12em] text-foreground/60">
            Ohio · PayPal &amp; credit card · free insured shipping
          </p>
        </div>

        <nav className="flex flex-wrap gap-5 text-[13.5px]">
          {footerLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="text-foreground/68 transition-colors hover:text-primary cursor-pointer"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="mailto:lukesguitarshop@gmail.com"
            className="text-foreground/68 transition-colors hover:text-primary cursor-pointer"
          >
            Contact
          </a>
        </nav>

        <p className="label-mono-sm tracking-[0.1em] text-foreground/50">
          © {year} Luke&apos;s Guitar Shop
        </p>
      </div>
    </footer>
  );
}
