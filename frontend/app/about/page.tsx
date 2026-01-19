export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">About Luke's Guitar Shop</h1>

        <div className="prose prose-lg">
          <p className="text-gray-600 mb-4">
            Welcome to Luke's Guitar Shop! This is a placeholder page for the about section.
          </p>

          <p className="text-gray-600 mb-4">
            More information about the shop, its history, and the owner will be added here soon.
          </p>

          <p className="text-gray-600 mb-4">
            In the meantime, feel free to browse our guitar listings and find your next instrument!
          </p>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'About | Luke\'s Guitar Shop',
  description: 'Learn more about Luke\'s Guitar Shop.',
};
