'use client';

export default function DevBanner() {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  const isDev = apiUrl.includes('-dev') || apiUrl.includes('localhost');

  if (!isDev) return null;

  return (
    <div className="bg-yellow-500 text-black text-center py-1 px-4 text-sm font-semibold">
      DEV ENVIRONMENT - API: {apiUrl}
    </div>
  );
}
