import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { getBaseUrl } from '@/lib/seo';

import { TELEGRAM_URL } from '../config';
import { FAQ_KEYS } from './faq';

/**
 * Structured data: Organization + SoftwareApplication + FAQPage. The FAQ
 * entities are built from the same translated strings the visible FAQ section
 * renders, which keeps the markup honest (a Google requirement).
 */
export async function LandingJsonLd({ locale }: { locale: Lang }) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const base = getBaseUrl();
  const url = locale === 'ru' ? `${base}/ru` : base;
  const inLanguage = locale === 'ru' ? 'ru' : 'uz-Latn';

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: 'SERVIO Kargo',
        url: base,
        logo: `${base}/android-chrome-512x512.png`,
        sameAs: [TELEGRAM_URL],
      },
      {
        '@type': 'SoftwareApplication',
        name: 'SERVIO Kargo',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, Telegram',
        description: t('metaDescription'),
        url,
        inLanguage,
        publisher: { '@id': `${base}/#organization` },
      },
      {
        '@type': 'FAQPage',
        inLanguage,
        mainEntity: FAQ_KEYS.map((key) => ({
          '@type': 'Question',
          name: t(`${key}Q`),
          acceptedAnswer: { '@type': 'Answer', text: t(`${key}A`) },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(graph).replace(/</g, '\\u003c'),
      }}
    />
  );
}
