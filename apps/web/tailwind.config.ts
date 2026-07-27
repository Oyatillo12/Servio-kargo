import type { Config } from 'tailwindcss';

/**
 * Dense, mobile-first admin UI (SPEC §5 / CLAUDE.md coding conventions).
 * Styling layer: Tailwind + shadcn/ui (Radix primitives in `components/ui`).
 * Brand indigo (Indigo 800 · #2B2687) + Inter / IBM Plex Mono, driven by the CSS
 * tokens in `app/globals.css`.
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
  		padding: '1rem'
  	},
  	extend: {
  		fontFamily: {
  			sans: [
  				'var(--font-sans)',
  				'Inter',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: [
  				'var(--font-mono)',
  				'IBM Plex Mono',
  				'ui-monospace',
  				'monospace'
  			]
  		},
  		colors: {
  			/* Panel design tokens (see `.theme-panel` in app/globals.css). The
  			 * neutral ramp is exposed by name so components can say `text-n-400`
  			 * instead of carrying a hex literal around. */
  			n: {
  				'900': 'var(--n-900)',
  				'600': 'var(--n-600)',
  				'400': 'var(--n-400)',
  				'200': 'var(--n-200)',
  				'100': 'var(--n-100)',
  				'0': 'var(--n-0)',
  				divider: 'var(--n-divider)',
  				band: 'var(--n-band)'
  			},
  			faint: 'hsl(var(--faint))',
  			warning: 'hsl(var(--warning))',
  			success: 'hsl(var(--success))',
  			brand: {
  				'indigo-950': 'var(--brand-indigo-950)',
  				'indigo-800': 'var(--brand-indigo-800)',
  				'indigo-600': 'var(--brand-indigo-600)',
  				'indigo-300': 'var(--brand-indigo-300)',
  				'indigo-50': 'var(--brand-indigo-50)',
  				copper: 'var(--brand-copper)',
  				'copper-soft': 'var(--brand-copper-soft)',
  				black: 'var(--brand-black)',
  				'gray-700': 'var(--brand-gray-700)',
  				'gray-500': 'var(--brand-gray-500)',
  				'gray-300': 'var(--brand-gray-300)',
  				surface: 'var(--brand-surface)',
  				success: 'var(--brand-success)',
  				warning: 'var(--brand-warning)',
  				error: 'var(--brand-error)',
  				info: 'var(--brand-info)'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  				hover: 'hsl(var(--primary-hover))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
