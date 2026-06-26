import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#111111',
        border: '#1e1e1e',
        'border-hover': '#2a2a2a',
        'text-primary': '#f0f0f0',
        'text-secondary': '#a0a0a0',
        'text-muted': '#6b6b6b',
        accent: '#4d9f5d',
        'accent-hover': '#5fb56f',
        danger: '#ef4444',
        'danger-hover': '#dc2626',
        warning: '#f59e0b',
        info: '#3b82f6',
      },
    },
  },
  plugins: [],
} satisfies Config