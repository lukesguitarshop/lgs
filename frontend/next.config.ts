import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rvb-img.reverb.com',
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
