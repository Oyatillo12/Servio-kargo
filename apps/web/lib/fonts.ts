/**
 * Shared next/font instances. The app has several root layouts (panel,
 * Mini App, the two marketing locales) and each must apply the same font
 * variables; next/font dedupes per-module, so they all import from here.
 *
 * One family of typography since D-013: TERMINAL (SPEC 5.0) — the panel, the
 * auth screens, the Mini App AND the public landing. Oswald sets headings and
 * uppercase micro-labels, Golos Text carries everything read as prose,
 * JetBrains Mono every figure compared down a column. All three ship
 * Cyrillic, which `/ru` and every Russian-speaking office needs. The landing
 * used to be frozen on Manrope + IBM Plex Mono; its screenshots were re-shot
 * from the TERMINAL panel, so the page now wears the product's own faces.
 */

import { Golos_Text, JetBrains_Mono, Oswald } from 'next/font/google';

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

/**
 * `className` for the `<html>` element of the marketing root layouts. The
 * same three faces as the panel; `.theme-landing` (globals.css) points
 * `--font-sans` / `--font-mono` / `--font-display` at them, exactly like
 * `.theme-panel` does — but without the panel's adaptive density scale, so
 * the landing keeps a marketing-sized 16px base.
 */
export const fontVariables = `${golosText.variable} ${oswald.variable} ${jetbrainsMono.variable}`;

/**
 * `className` for the `<html>` element of the panel root layout. `theme-panel`
 * points `--font-sans` / `--font-mono` / `--font-display` at the three faces
 * above (globals.css), so the marketing pages never download them.
 */
export const panelFontVariables = `${golosText.variable} ${oswald.variable} ${jetbrainsMono.variable} theme-panel`;
