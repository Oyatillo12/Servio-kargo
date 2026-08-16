/**
 * Mini App root layout (SPEC §10). Its own route-group root — the TWA
 * surface must not inherit the panel's cookie-based locale: the language
 * here is the CUSTOMER's (`customers.lang`), not the admin's UI choice.
 *
 * It wears the TERMINAL faces (SPEC 10.4): the customer reads a track code and
 * a som total here, and those have to be the same shapes the panel and the
 * receipts use. `panelFontVariables` also carries the `theme-panel` marker,
 * which in this system only maps the three font variables — the colours the
 * Mini App shows come from `twa.css`, half of them from Telegram itself.
 */

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { ThemeBridge } from '@/features/twa/components/theme-bridge';
import { getTwaContext } from '@/lib/twa/auth';
import { panelFontVariables } from '@/lib/fonts';

import '../../../globals.css';
import '../../twa.css';

export const metadata: Metadata = {
  title: 'Kabinet',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Telegram's webview manages its own zoom; a user pinch fights the UI.
  maximumScale: 1,
};

export default async function TwaLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { tenantId: string };
}) {
  const gate = await getTwaContext(params.tenantId);
  const locale = gate.state === 'ok' ? gate.customer.lang : 'uz';
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} className={panelFontVariables}>
      <body className="twa-body font-sans">
        {/* Official Telegram bridge — must load before any client code asks
            for initData, hence beforeInteractive in this group's root. */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <ThemeBridge />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-4">
            {children}
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
