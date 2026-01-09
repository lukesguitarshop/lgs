import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16">
      <div className="mb-8">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          🎸 Guitar Price Database
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl">
          Track real-time guitar prices from Reverb marketplace. Browse thousands of guitars
          with detailed pricing history and market insights.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mt-8">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-semibold mb-2">Price Tracking</h3>
          <p className="text-gray-600">
            Monitor price trends across 7 condition levels from Brand New to Poor
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold mb-2">Smart Search</h3>
          <p className="text-gray-600">
            Find specific guitars by make, model, and year with advanced filtering
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="text-4xl mb-4">📈</div>
          <h3 className="text-xl font-semibold mb-2">Market Data</h3>
          <p className="text-gray-600">
            Get average, min, and max prices based on real marketplace listings
          </p>
        </div>
      </div>

      <div className="mt-12 flex gap-4">
        <Link
          href="/guitars"
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Browse Guitars
        </Link>
        <Link
          href="/about"
          className="bg-gray-200 text-gray-800 px-8 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
        >
          Learn More
        </Link>
      </div>

      <div className="mt-16 p-6 bg-gray-50 rounded-lg max-w-2xl">
        <h3 className="text-lg font-semibold mb-2">Data Source</h3>
        <p className="text-gray-600">
          Our database is powered by real-time data from{' '}
          <a
            href="https://reverb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700"
          >
            Reverb.com
          </a>
          , the largest online marketplace for musical instruments.
        </p>
      </div>
    </div>
  );
}
