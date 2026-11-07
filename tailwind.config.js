/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        cairo: ["Cairo", "sans-serif"],
        tajawal: ["Tajawal", "sans-serif"],
        noto: ["'Noto Sans Arabic'", "sans-serif"],
        inter: ["Inter", "sans-serif"],
      },
      colors: {
        ezone: {
          navy: '#01334E',
          deep: '#012336',
          darker: '#011A29',
          surface: '#023C5C',
          hover: '#044C73',
          border: '#0A4A6E',
          accent: '#0284C7',
          sky: '#38BDF8',
          light: '#EBF4F8',
          white: '#FFFFFF',
        },
        flux: {
          bg: '#EBF4F8',
          dark: '#01334E',
          darkCard: '#012336',
          canvas: '#F4F7FA',
          lime: '#FFFFFF',
          lavender: '#38BDF8',
          muted: '#8E93A0',
          border: '#E2E4E9',
        },
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        navy: {
          800: '#111827',
          850: '#0f172a',
          900: '#0b1120',
          950: '#060a12',
        },
      },
    },
  },
  plugins: [],
};
