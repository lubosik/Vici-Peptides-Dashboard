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
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Neon accent colors
        neon: {
          cyan: 'rgb(147, 197, 253)',
          pink: 'rgb(236, 72, 153)',
          green: 'rgb(34, 197, 94)',
          orange: 'rgb(249, 115, 22)',
          yellow: 'rgb(234, 179, 8)',
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
        'neon-cyan': '0 0 10px rgba(147, 197, 253, 0.3), 0 0 20px rgba(147, 197, 253, 0.2)',
        'neon-pink': '0 0 10px rgba(236, 72, 153, 0.3), 0 0 20px rgba(236, 72, 153, 0.2)',
        'neon-green': '0 0 10px rgba(34, 197, 94, 0.3), 0 0 20px rgba(34, 197, 94, 0.2)',
        'neon-orange': '0 0 10px rgba(249, 115, 22, 0.3), 0 0 20px rgba(249, 115, 22, 0.2)',
        'neon-yellow': '0 0 10px rgba(234, 179, 8, 0.3), 0 0 20px rgba(234, 179, 8, 0.2)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
