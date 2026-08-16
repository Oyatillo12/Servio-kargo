/**
 * Shared next/font instances. The app has several root layouts (panel,
 * Mini App, the two marketing locales) and each must apply the same font
 * variables; next/font dedupes per-module, so they all import from here.
 *
 * Two families of typography live here, and they do NOT mix:
 *
 *  - TERMINAL (SPEC 5.0) — the panel, the auth screens and the Mini App.
 *    Oswald sets headings and uppercase micro-labels, Golos Text carries
 *    everything read as prose, JetBrains Mono every figure compared down a
 *    column. All three ship Cyrillic, which `/ru` and every Russian-speaking
 *    office needs.
 *  - The public landing, frozen on Manrope + IBM Plex Mono (D-012 keeps the
 *    marketing pages out of the redesign until the screenshots on them are
 *    re-shot).
 */

import {
  Golos_Text,
  IBM_Plex_Mono,
  JetBrains_Mono,
  Manrope,
  Oswald,
} from 'next/font/google';

/**
 * TERMINAL headings and eyebrows. Condensed on purpose: `TREK / CN-4821` sits
 * above a value in the width a normal grotesque needs for half of it, which is
 * what makes a dense screen readable without shrinking the data.
 */
export const oswald = Oswald({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-panel-display',
  display: 'swap',
});

/**
 * TERMINAL body face. Golos Text is drawn for interfaces in both scripts by the
 * same hand, so a Russian office and an Uzbek one get the same texture rather
 * than a Latin face with a bolted-on Cyrillic.
 */
export const golosText = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-panel-sans',
  display: 'swap',
});

/**
 * Every figure in the panel is a quantity compared down a column — track codes,
 * kg, som. JetBrains Mono has Cyrillic too, so a mono label never falls back
 * mid-word in Russian.
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-panel-mono',
  display: 'swap',
});

/** The public landing's typeface — see the note above; deliberately frozen. */
export const manrope = Manrope({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
});

/** The landing's mono. The panel's is JetBrains, mapped by `.theme-panel`. */
export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

/** `className` for the `<html>` element of the marketing root layouts. */
export const fontVariables = `${manrope.variable} ${plexMono.variable}`;

/**
 * `className` for the `<html>` element of the panel root layout. `theme-panel`
 * points `--font-sans` / `--font-mono` / `--font-display` at the three faces
 * above (globals.css), so the marketing pages never download them.
 */
export const panelFontVariables = `${golosText.variable} ${oswald.variable} ${jetbrainsMono.variable} theme-panel`;
