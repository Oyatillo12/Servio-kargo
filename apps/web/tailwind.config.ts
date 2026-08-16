import type { Config } from 'tailwindcss';

/**
 * TERMINAL (SPEC 5.0 / D-012) — the panel, the auth screens and the Mini App.
 * Styling layer: Tailwind + shadcn/ui (Radix primitives in `components/ui`).
 * Every value here points at a CSS token in `app/globals.css`; nothing in this
 * file is a colour, a size or a radius of its own.
 *
 * The type steps (`text-body`, `text-small`, …) and the control heights
 * (`h-control`, `h-row`) are ADAPTIVE: the same class is denser on desktop and
 * bigger on a phone, because the tokens behind them change at `md`. Components
 * name a step, never a pixel size.
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Golos Text', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Oswald', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        /* The density scale. Tailwind's own `text-xs … text-2xl` stay
         * available for the odd one-off, but a component that means "body
         * text" says `text-body` and follows the breakpoint. */
        micro: ['var(--fs-micro)', { lineHeight: 'var(--lh-micro)' }],
        small: ['var(--fs-small)', { lineHeight: 'var(--lh-small)' }],
        body: ['var(--fs-body)', { lineHeight: 'var(--lh-body)' }],
        lead: ['var(--fs-lead)', { lineHeight: 'var(--lh-lead)' }],
        title: ['var(--fs-title)', { lineHeight: 'var(--lh-title)' }],
        display: [
          'var(--fs-display)',
          { lineHeight: 'var(--lh-display)', letterSpacing: '-0.01em' },
        ],
      },
      height: {
        control: 'var(--h-control)',
        row: 'var(--h-row)',
      },
      width: {
        /* Square icon buttons stay square at both densities. */
        control: 'var(--h-control)',
      },
      minHeight: {
        control: 'var(--h-control)',
        row: 'var(--h-row)',
      },
      colors: {
        /* The neutral ramp by name, so a component says `text-n-400` rather
         * than carrying a hex literal around. */
        n: {
          '900': 'var(--n-900)',
          '600': 'var(--n-600)',
          '400': 'var(--n-400)',
          '200': 'var(--n-200)',
          '100': 'var(--n-100)',
          '0': 'var(--n-0)',
          divider: 'var(--n-divider)',
          band: 'var(--n-band)',
        },
        /* Ground, by the names the system talks in (SPEC 5.0). */
        paper: 'var(--paper)',
        surface: {
          DEFAULT: 'var(--surface)',
          alt: 'var(--surface-2)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          '2': 'var(--ink-2)',
          '3': 'var(--ink-3)',
        },
        rule: {
          DEFAULT: 'var(--rule)',
          soft: 'var(--rule-soft)',
        },
        /* The one action colour. `primary` is the same thing in shadcn's
         * vocabulary — both exist so a button can say `bg-primary` and a
         * hand-drawn accent bar can say `bg-signal`. */
        signal: {
          DEFAULT: 'var(--signal)',
          strong: 'var(--signal-strong)',
          soft: 'var(--signal-soft)',
        },
        faint: 'hsl(var(--faint))',
        warning: 'hsl(var(--warning))',
        success: 'hsl(var(--success))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          hover: 'hsl(var(--primary-hover))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        /* Sharp on purpose — freight paperwork, not a consumer app: 4px cards,
         * 2px controls, square fields. Kept as shadcn's `--radius` arithmetic
         * rather than literal pixels so the frozen landing, which sets its own
         * 10px `--radius`, keeps the corners it was drawn with. */
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
