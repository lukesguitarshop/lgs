import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Luke's Guitar Shop. All rights reserved.
          </p>
          <nav className="flex space-x-6">
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900 transition-colors text-sm"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="text-gray-600 hover:text-gray-900 transition-colors text-sm"
            >
              About
            </Link>
            <Link
              href="/admin"
              className="text-gray-600 hover:text-gray-900 transition-colors text-sm"
            >
              Admin
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}