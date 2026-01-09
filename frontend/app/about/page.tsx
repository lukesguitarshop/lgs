export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-900 mb-6">About Guitar Price Database</h1>

      <div className="prose prose-lg max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Mission</h2>
          <p className="text-gray-700 mb-4">
            Guitar Price Database provides accurate, up-to-date pricing information for guitars from the Reverb marketplace.
            Our goal is to help buyers and sellers make informed decisions by providing comprehensive price tracking and market insights.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">How It Works</h2>
          <div className="bg-gray-50 p-6 rounded-lg space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">1. Data Collection</h3>
              <p className="text-gray-700">
                We scrape guitar listings from Reverb.com daily, collecting pricing data across multiple conditions
                from Brand New to Poor.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">2. Price Aggregation</h3>
              <p className="text-gray-700">
                For each guitar model and year, we calculate average, minimum, and maximum prices for each condition level,
                giving you a complete picture of the market.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Historical Tracking</h3>
              <p className="text-gray-700">
                Price snapshots are stored daily, allowing you to track price trends over time and identify the best
                time to buy or sell.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Condition Levels</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900">Brand New</h4>
              <p className="text-sm text-gray-600">Factory sealed, never used</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900">Mint</h4>
              <p className="text-sm text-gray-600">Pristine condition, no wear</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900">Excellent</h4>
              <p className="text-sm text-gray-600">Minimal wear, fully functional</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900">Very Good</h4>
              <p className="text-sm text-gray-600">Light wear, good condition</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900">Good</h4>
              <p className="text-sm text-gray-600">Normal wear, some cosmetic issues</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900">Fair</h4>
              <p className="text-sm text-gray-600">Heavy wear, may need repairs</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900">Poor</h4>
              <p className="text-sm text-gray-600">Significant issues, for parts/restoration</p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Source</h2>
          <p className="text-gray-700 mb-4">
            All pricing data comes from{' '}
            <a
              href="https://reverb.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Reverb.com
            </a>
            , the world's largest online marketplace for buying and selling new, used, and vintage musical instruments.
          </p>
          <p className="text-gray-700">
            We are not affiliated with Reverb.com. This is an independent project built to provide
            market insights for guitar enthusiasts.
          </p>
        </section>

        <section className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Tech Stack</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
            <div>
              <h4 className="font-semibold mb-2">Frontend</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Next.js 15 with App Router</li>
                <li>TypeScript</li>
                <li>Tailwind CSS</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Backend</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>.NET 9 Web API</li>
                <li>MongoDB for data storage</li>
                <li>Daily scraper with Polly resilience</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
