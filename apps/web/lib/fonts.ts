/**
 * Shared next/font instances. The app has multiple root layouts (panel +
 * the two marketing locales) and each must apply the same font variables;
 * next/font dedupes per-module, so they all import from here.
 */

import { IBM_Plex_Mono, Inter } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

/** `className` for the `<html>` element of every root layout. */
export const fontVariables = `${inter.variable} ${plexMono.variable}`;
