import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/api';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep authenticated/app surfaces out of the index.
      disallow: ['/api/', '/admin/', '/account/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
