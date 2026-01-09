import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-gray-900 text-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold">🎸</span>
            <span className="text-xl font-semibold">Guitar Price Database</span>
          </Link>
          <nav className="flex space-x-6">
            <Link
              href="/"
              className="hover:text-blue-400 transition-colors"
            >
              Home
            </Link>
            <Link
              href="/guitars"
              className="hover:text-blue-400 transition-colors"
            >
              Browse Guitars
            </Link>
            <Link
              href="/about"
              className="hover:text-blue-400 transition-colors"
            >
              About
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
