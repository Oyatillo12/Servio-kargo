import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/lib/fonts';

import '../globals.css';

export const metadata: Metadata = {
  title: 'SERVIO Kargo — Admin',
  description: 'Multi-tenant cargo tracking (China → Uzbekistan)',
  // The panel is a private tool — only the marketing pages should be indexed.
  // robots.txt deliberately does not Disallow these paths (that would both
  // advertise /sa and stop crawlers from ever seeing this noindex).
  robots: { index: false, follow: false },
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Locale comes from the NEXT_LOCALE cookie (lib/locale.ts) — the panel runs
  // next-intl without i18n routing, so paths stay locale-free.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={fontVariables}>
      <body className="font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
