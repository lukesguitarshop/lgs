export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">About</h3>
            <p className="text-gray-400">
              Guitar Price Database provides real-time pricing data from Reverb marketplace
              to help you make informed buying and selling decisions.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-gray-400">
              <li>
                <a href="/" className="hover:text-blue-400 transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="/guitars" className="hover:text-blue-400 transition-colors">
                  Browse Guitars
                </a>
              </li>
              <li>
                <a href="/about" className="hover:text-blue-400 transition-colors">
                  About
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Data Source</h3>
            <p className="text-gray-400">
              Pricing data sourced from{' '}
              <a
                href="https://reverb.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Reverb.com
              </a>
            </p>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-gray-400 text-sm">
          <p>&copy; {new Date().getFullYear()} Guitar Price Database. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
