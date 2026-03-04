import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#111111',
        border: '#1e1e1e',
        'text-primary': '#f0f0f0',
        'text-secondary': '#6b6b6b',
        'text-body': '#a0a0a0',
        accent: '#4d9f5d',
        'status-green': '#22c55e',
        'status-red': '#ef4444',
        'status-yellow': '#eab308',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
      },
      fontSize: {
        'hero-mobile': ['40px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'hero-desktop': ['64px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'section-mobile': ['28px', { lineHeight: '1.2', fontWeight: '600' }],
        'section-desktop': ['40px', { lineHeight: '1.2', fontWeight: '600' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [],
} satisfies Config
