import Link from 'next/link';
import Image from 'next/image';

export default async function HomePage() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <section className="text-center py-16 px-4">
        <h1 className="text-6xl font-bold text-gray-900 mb-6">
          Luke's Guitar Shop
        </h1>
        <p className="text-2xl text-gray-600 max-w-3xl mx-auto mb-8">
          Browse my collection of guitars for sale.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/search"
            className="inline-block bg-[#df5e15] hover:bg-[#c74d12] text-white text-xl font-semibold px-8 py-4 rounded-lg transition-all"
          >
            View Guitars
          </Link>
          <Link
            href="/about"
            className="inline-block bg-[#df5e15] hover:bg-[#c74d12] text-white text-xl font-semibold px-8 py-4 rounded-lg transition-all"
          >
            About
          </Link>
        </div>
      </section>
    </div>
  );
}