import type { MetadataRoute } from 'next';

import { getBaseUrl } from '@/lib/seo';

/**
 * Allow everything: the panel opts out via `robots: { index: false }` in its
 * root layout instead of a Disallow here — a robots.txt entry would both
 * advertise the hidden /sa path and stop crawlers from ever seeing the
 * noindex.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
