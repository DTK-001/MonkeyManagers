import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1f1d36',
        navy: '#262340',
        panel: '#2a2748',
        ivory: '#f6f4ff',
        muted: '#aaa7c2',
        gold: '#10e5eb',
        emerald: '#19cbd4',
        danger: '#da107b'
      },
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: { card: '0 20px 56px rgba(8,6,25,.34)' }
    }
  },
  plugins: []
} satisfies Config;
