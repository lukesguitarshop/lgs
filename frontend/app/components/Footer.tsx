import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} Luke's Guitar Shop. All rights reserved.
          </p>
          <nav className="flex space-x-6">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer"
            >
              Home
            </Link>
            <Link
              href="/shop-info"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer"
            >
              Shop Info
            </Link>
            <Link
              href="/reviews"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer"
            >
              Reviews
            </Link>
            <Link
              href="/contact"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer"
            >
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}