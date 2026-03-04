import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#111111',
        border: '#1e1e1e',
        'text-primary': '#f0f0f0',
        'text-secondary': '#6b6b6b',
        accent: '#4d9f5d',
        'status-up': '#22c55e',
        'status-down': '#ef4444',
        'status-degraded': '#eab308',
        'no-data': '#2a2a2a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
} satisfies Config
