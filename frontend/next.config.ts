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
