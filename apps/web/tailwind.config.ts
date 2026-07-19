import type { Config } from 'tailwindcss';

/**
 * Dense, mobile-first admin UI (SPEC §5 / CLAUDE.md coding conventions).
 * No component libraries — plain Tailwind utility classes only.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
