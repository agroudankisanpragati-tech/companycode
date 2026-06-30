/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        lg: '2rem',
      },
    },
    extend: {
      colors: {
        ink: {
          950: '#050816',
          900: '#0a1020',
          800: '#12203a',
        },
        aura: {
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        ember: {
          400: '#f59e0b',
          500: '#f97316',
          600: '#ea580c',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(14,165,233,0.15), 0 20px 45px rgba(2,132,199,0.22)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};