/** @type {import('tailwindcss').Config} */

// COLOR SYSTEM — derived directly from the official LSPU seal
// (sampled from LSPU_Seal-HD.png):
//   navy ring & lettering  -> #0B0E8C  (primary)
//   gold book              -> #F5C400  (secondary)
//   agriculture green      -> #0B7A33  (accent)
//   technology maroon      -> #7A1420  (danger — also used for "invalid /
//                              mismatch" states in the guard scanner)
// Base sample hexes were nudged a few points for WCAG AA contrast on
// white/near-white surfaces; the hue and relationship to the seal are
// preserved. Do not swap these for generic Tailwind colors (blue-600,
// green-500, etc.) anywhere in the app — always reference the palette
// below so the institutional identity stays consistent.

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f3f3f9',
          100: '#e2e2f1',
          200: '#c0c0e1',
          300: '#999acf',
          400: '#5e60b3',
          500: '#0B0E8C', // LSPU Navy — seal ring / wordmark
          600: '#090c77',
          700: '#080a62',
          800: '#06084d',
          900: '#040638',
          950: '#030423',
        },
        secondary: {
          50: '#fefcf2',
          100: '#fef8e0',
          200: '#fcf0bd',
          300: '#fbe694',
          400: '#f8d857',
          500: '#F5C400', // LSPU Gold — seal book
          600: '#d0a700',
          700: '#ac8900',
          800: '#876c00',
          900: '#624e00',
          950: '#3d3100',
        },
        accent: {
          50: '#f3f8f5',
          100: '#e2efe7',
          200: '#c0dcca',
          300: '#99c7a9',
          400: '#5ea778',
          500: '#0B7A33', // LSPU Green — seal agriculture sector
          600: '#09682b',
          700: '#085524',
          800: '#06431c',
          900: '#043114',
          950: '#031e0d',
        },
        danger: {
          50: '#f8f3f4',
          100: '#efe3e4',
          200: '#dcc2c5',
          300: '#c79ca1',
          400: '#a7646c',
          500: '#7A1420', // LSPU Maroon — seal technology sector
          600: '#68111b',
          700: '#550e16',
          800: '#430b12',
          900: '#31080d',
          950: '#1e0508',
        },
        // Neutral surfaces stay on Tailwind's slate scale on purpose —
        // an institutional dashboard needs a quiet, cool-gray backdrop
        // so the four brand colors keep their meaning (status, actions,
        // branding) instead of competing with a tinted neutral.
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['"Source Serif 4"', '"Georgia"', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 3px 0 rgb(15 23 42 / 0.08)',
      },
      keyframes: {
        'seal-in': {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'seal-in': 'seal-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-up': 'fade-up 0.6s ease-out 0.3s forwards',
      },
    },
  },
  plugins: [],
};
