import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
          foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--input) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)',
        },
        // Neon accent colors
        neon: {
          cyan: 'rgb(120, 200, 255)',
          pink: 'rgb(255, 100, 200)',
          green: 'rgb(100, 255, 150)',
          orange: 'rgb(255, 150, 100)',
          purple: 'rgb(150, 100, 255)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'neon-cyan': '0 0 10px rgba(120, 200, 255, 0.4), 0 0 20px rgba(120, 200, 255, 0.3), 0 0 30px rgba(120, 200, 255, 0.2)',
        'neon-pink': '0 0 10px rgba(255, 100, 200, 0.4), 0 0 20px rgba(255, 100, 200, 0.3), 0 0 30px rgba(255, 100, 200, 0.2)',
        'neon-green': '0 0 10px rgba(100, 255, 150, 0.4), 0 0 20px rgba(100, 255, 150, 0.3), 0 0 30px rgba(100, 255, 150, 0.2)',
        'neon-orange': '0 0 10px rgba(255, 150, 100, 0.4), 0 0 20px rgba(255, 150, 100, 0.3), 0 0 30px rgba(255, 150, 100, 0.2)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
