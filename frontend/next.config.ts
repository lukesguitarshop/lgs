import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rvb-img.reverb.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.sweetwater.com',
        pathname: '/**',
      },
    ],
  },
  // The API only allows the bare domain (CORS), and logins live in localStorage,
  // which is per-origin. Send www visitors to the bare domain so the site works
  // the same no matter which one they typed.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.lukesguitarshop.com' }],
        destination: 'https://lukesguitarshop.com/:path*',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/feed.xml',
        destination: '/api/feed',
      },
      {
        source: '/products.xml',
        destination: '/api/feed',
      },
    ];
  },
};

export default nextConfig;
