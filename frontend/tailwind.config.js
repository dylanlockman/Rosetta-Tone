/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // "Studio Instrument" palette — warm charcoal chassis, gold accent.
        ink: {
          950: '#0B0C10', // app background
          900: '#111318', // panels
          850: '#161920', // raised panels / inputs
          800: '#1D212B', // hover surfaces
          700: '#262B38', // borders (strong)
          600: '#333A4A',
        },
        chrome: {
          100: '#ECEAE4', // warm white text
          300: '#B9BCC5',
          400: '#8A8F9E', // muted text
          500: '#5C6272', // faint text
        },
        gold: {
          300: '#FFD98A',
          400: '#F5B848', // primary accent
          500: '#E09F26',
          600: '#B87E14',
        },
      },
      boxShadow: {
        key: '0 2px 0 rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.35)',
        glowGold: '0 0 12px rgba(245,184,72,0.45)',
      },
    },
  },
  plugins: [],
}
