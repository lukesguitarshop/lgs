export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Back button skeleton */}
      <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left side - Image skeleton */}
        <div className="space-y-4">
          <div className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-20 h-20 bg-gray-200 rounded-md animate-pulse" />
            ))}
          </div>
        </div>

        {/* Right side - Content skeleton */}
        <div className="space-y-6">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-3/4 bg-gray-200 rounded animate-pulse" />
          <div className="border-t border-b border-gray-200 py-6">
            <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse mt-2" />
          </div>
          <div className="h-14 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-14 w-full bg-gray-200 rounded animate-pulse" />
          <div className="pt-6 border-t border-gray-200 space-y-4">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
