import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './context/**/*.{ts,tsx,js,jsx}',
    './lib/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Editorial sports academy palette
        ivory: '#fafaf7',
        paper: '#ffffff',
        sand: {
          50: '#f5f1e8',
          100: '#e8dfc5',
          200: '#d4c89e',
        },
        ink: {
          DEFAULT: '#0b1a2f',
          dim: '#3d4c63',
          faint: '#6b7689',
          mist: '#a0a8b8',
          hair: '#e4e1d9',
        },
        crimson: {
          DEFAULT: '#d4342f',
          dark: '#a8221e',
        },
        sage: {
          DEFAULT: '#7a9b7e',
          dark: '#5a7560',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 26, 47, 0.04), 0 4px 12px rgba(11, 26, 47, 0.04)',
        'card-hover': '0 1px 2px rgba(11, 26, 47, 0.06), 0 12px 32px rgba(11, 26, 47, 0.08)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;
