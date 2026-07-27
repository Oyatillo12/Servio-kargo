import type { Metadata, Viewport } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Lang } from '@kargotrack/shared';

import { getBaseUrl } from '@/lib/seo';

/**
 * Shared metadata for the two landing pages (`/` = uz, `/ru` = ru).
 * Locale is passed explicitly so the pages stay statically rendered — never
 * read it from the cookie here.
 */
export async function landingMetadata(locale: Lang): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const base = getBaseUrl();
  const path = locale === 'ru' ? '/ru' : '/';

  return {
    metadataBase: new URL(base),
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: path,
      languages: {
        uz: '/',
        ru: '/ru',
        'x-default': '/',
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'SERVIO Kargo',
      locale: locale === 'ru' ? 'ru_RU' : 'uz_UZ',
      url: path,
      title: t('metaTitle'),
      description: t('metaDescription'),
      // Static file, not a generated route. It used to be an ImageResponse at
      // app/og/route.tsx rendered by satori at build time, which meant one
      // unsupported CSS value there failed the whole production build — and it
      // did. The card is locale-neutral and changes about never, so it is
      // checked in as public/og.png instead.
      //
      // To restyle it: recover that route from git history (last present in
      // e90bc5d), render it once, replace the PNG, and delete the route again.
      // Note the archived copy is the BROKEN version — satori accepts only
      // `solid` and `dashed` borders, so its `borderTop: '4px dotted ...'`
      // must become `dashed`, and every div needs an explicit `display`.
      images: [{ url: '/og.png', width: 1200, height: 630, alt: t('ogAlt') }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('metaTitle'),
      description: t('metaDescription'),
      images: [{ url: '/og.png', alt: t('ogAlt') }],
    },
    manifest: '/site.webmanifest',
    icons: {
      icon: [
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      ],
      apple: '/apple-touch-icon.png',
    },
  };
}

export const landingViewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2B2687',
};
