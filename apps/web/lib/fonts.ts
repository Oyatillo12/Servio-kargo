/**
 * Shared next/font instances. The app has multiple root layouts (panel +
 * the two marketing locales) and each must apply the same font variables;
 * next/font dedupes per-module, so they all import from here.
 */

import { IBM_Plex_Mono, IBM_Plex_Sans, Manrope } from 'next/font/google';

/**
 * The public landing's typeface. Manrope rather than the panel's Plex Sans:
 * the landing is read once by a stranger on a phone, so it wants a warmer,
 * higher-contrast headline face than the dense data screens do. Cyrillic is
 * in the subset because `/ru` renders the same components.
 */
export const manrope = Manrope({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
});

/**
 * The admin panel's typeface. It ships its own variable rather than reusing
 * `--font-sans` so the marketing pages never download it — `.theme-panel`
 * points `--font-sans` at this one, and only the panel root layout sets it.
 */
export const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-panel-sans',
  display: 'swap',
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

/** `className` for the `<html>` element of the marketing root layouts. */
export const fontVariables = `${manrope.variable} ${plexMono.variable}`;

/** `className` for the `<html>` element of the panel root layout. */
export const panelFontVariables = `${plexSans.variable} ${plexMono.variable} theme-panel`;
