/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1B2440', soft: '#3A4566', muted: '#6B7390' },
        paper: '#F5F6FA',
        line: '#E3E6EF',
        market: { DEFAULT: '#0F766E', dark: '#0B5C56', light: '#E3F3F1' },
        saffron: { DEFAULT: '#E8A317', dark: '#9A6A06', light: '#FDF3DC' },
        risk: { healthy: '#0F766E', slow: '#B7791F', atrisk: '#DD6B20', dead: '#B42318', none: '#64748B' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', '"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: { lift: '0 1px 2px rgba(27,36,64,.06), 0 8px 24px -12px rgba(27,36,64,.18)' },
    },
  },
  plugins: [],
};
