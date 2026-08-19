import Link from 'next/link';

const footerLinks = [
  { href: '/#inventory', label: 'Listings' },
  { href: '/shop-info', label: 'Shop info' },
  { href: '/sold', label: 'Sold' },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-primary">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-end justify-between gap-6 px-5 pt-[34px] pb-11">
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
          © {new Date().getFullYear()} Luke&apos;s Guitar Shop
        </p>
      </div>
    </footer>
  );
}
