/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      'xs': '375px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.25rem',
        lg: '2rem',
      },
    },
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        secondary: {
          50: '#fef3c7',
          500: '#f59e0b',
          700: '#b45309',
        },
      },
      keyframes: {
        slideUp: {
          from: { opacity: '0', transform: 'translateY(40px) scale(0.97)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        slideUp: 'slideUp 0.32s cubic-bezier(0.22,1,0.36,1)',
        fadeIn:  'fadeIn 0.2s ease',
      },
    },
  },
  plugins: [],
};
