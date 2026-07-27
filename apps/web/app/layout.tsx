import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { Toaster } from '@/components/ui/sonner';

import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SERVIO Kargo — Admin',
  description: 'Multi-tenant cargo tracking (China → Uzbekistan)',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Locale comes from the NEXT_LOCALE cookie (lib/locale.ts) — the panel runs
  // next-intl without i18n routing, so paths stay locale-free.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${plexMono.variable}`}>
      <body className="font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
