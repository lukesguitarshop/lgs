import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lukesguitarshop.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/profile',
          '/checkout',
          '/cart',
          '/favorites',
          '/offers',
          '/messages',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/api/feed'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
