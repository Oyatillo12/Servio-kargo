import type { MetadataRoute } from 'next';

import { getBaseUrl } from '@/lib/seo';

/** The two public pages; everything else is a noindex admin surface. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getBaseUrl();
  const languages = { uz: `${base}/`, ru: `${base}/ru` };

  return [
    {
      url: `${base}/`,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages },
    },
    {
      url: `${base}/ru`,
      changeFrequency: 'monthly',
      priority: 0.9,
      alternates: { languages },
    },
  ];
}
