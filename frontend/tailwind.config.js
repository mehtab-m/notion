/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/pages/landing/**/*.{js,jsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        pastel: {
          lavender: '#f3f0ff',
          mint: '#ecfdf5',
          peach: '#fff7ed',
          sky: '#f0f9ff',
          rose: '#fff1f2',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 24px rgba(99, 102, 241, 0.08)',
        card: '0 8px 32px rgba(0, 0, 0, 0.06)',
        glow: '0 12px 40px rgba(99, 102, 241, 0.18)',
      },
    },
  },
  plugins: [],
};
