import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#071520',
        navy: '#0b1d2a',
        panel: '#102734',
        ivory: '#f4efe3',
        muted: '#9da9aa',
        gold: '#c3a46d',
        emerald: '#3fab77',
        danger: '#d86161'
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: { card: '0 18px 50px rgba(0,0,0,.24)' }
    }
  },
  plugins: []
} satisfies Config;
