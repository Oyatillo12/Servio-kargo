import type { ReactNode } from 'react';

import { fontVariables } from '@/lib/fonts';
import { landingViewport } from '@/features/marketing/metadata';

import '../../globals.css';

export const viewport = landingViewport;

/**
 * Root layout for the public Uzbek landing page (`/`).
 *
 * One of three root layouts (see also `(marketing)/(ru)` and `(panel)`): the
 * marketing pages hardcode `<html lang>` per locale and never read cookies,
 * which keeps them statically rendered. No NextIntlClientProvider — the
 * landing tree is RSC and client leaves receive translated strings as props.
 */
export default function UzMarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="uz" className={fontVariables}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
