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
 *
 * `theme-landing` maps the TERMINAL faces (see globals.css); the body sets
 * the ground colour directly so it also paints the overscroll area.
 */
export default function UzMarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="uz" className={`${fontVariables} theme-landing`}>
      <body className="bg-paper font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
