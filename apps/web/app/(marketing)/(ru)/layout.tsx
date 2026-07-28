import type { ReactNode } from 'react';

import { fontVariables } from '@/lib/fonts';
import { landingViewport } from '@/features/marketing/metadata';

import '../../globals.css';

export const viewport = landingViewport;

/** Root layout for the public Russian landing page (`/ru`) — see `(uz)`. */
export default function RuMarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ru" className={`${fontVariables} theme-landing`}>
      <body className="bg-white font-sans">{children}</body>
    </html>
  );
}
