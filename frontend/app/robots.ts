import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lukesguitarshop.com';

  // One group for everyone. A crawler obeys only the most specific group that names
  // it, so a separate "Googlebot" group would replace these rules for Google rather
  // than add to them, opening /admin and /checkout to it.
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/feed'],
        disallow: [
          '/api/',
          '/admin',
          '/account',
          '/profile',
          '/checkout',
          '/cart',
          '/favorites',
          '/offers',
          '/messages',
          '/order',
          '/deposit',
          '/impersonate',
          '/reset-password',
          '/verify-email',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
