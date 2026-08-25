/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			/*
  			 * The neutral ramp for every dark surface, border and dim label.
  			 *
  			 * Tailwind's `slate` is a blue-tinted grey: on the near-black app
  			 * canvas (`ink-900`, the colour the root Layout paints) a slate-800
  			 * card reads as navy sitting on black rather than as one surface
  			 * lifted off another. `ink` keeps slate's lightness steps — so
  			 * contrast and elevation stay where they were — and drops the hue.
  			 *
  			 * 900 is the canvas: layout chrome (sidebar, app bar, bottom nav,
  			 * page roots) paints it so nothing seams against the root.
  			 * 950 recesses below it, 800 is a card, 700 an input or border.
  			 * 100-600 are text and icons, lightness-matched to slate.
  			 */
  			ink: {
  				'50': '#fafafa',
  				'100': '#f5f5f6',
  				'200': '#e5e5e7',
  				'300': '#d2d2d5',
  				'400': '#a1a1a8',
  				'500': '#71717a',
  				'600': '#52525b',
  				'700': '#26262b',
  				'800': '#141417',
  				'900': '#0a0a0c',
  				'950': '#070709'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
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
  		keyframes: {
  			'neon-pulse': {
  				'0%, 100%': {
  					boxShadow: '0 0 15px -3px rgba(var(--neon-shadow), var(--neon-shadow-opacity)), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
  				},
  				'50%': {
  					boxShadow: '0 0 25px 2px rgba(var(--neon-shadow), calc(var(--neon-shadow-opacity) + 0.2)), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
  				}
  			},
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
  			'neon-pulse': 'neon-pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}