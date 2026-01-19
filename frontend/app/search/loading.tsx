export default function SearchLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Loading guitars...</h2>
          <p className="text-gray-500 mt-2">Fetching all guitars from the database</p>
        </div>
      </div>
    </div>
  );
}
