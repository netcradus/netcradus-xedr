/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0B1437',
          800: '#101A4A',
          700: '#16205B',
        },
        brand: {
          blue: '#3B6FE0',
        },
        severity: {
          high: '#E14D4D',
          medium: '#F2A93C',
          low: '#2FB870',
          info: '#9AA3B2',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04)',
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
}
