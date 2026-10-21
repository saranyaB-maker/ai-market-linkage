/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Flat aliases used throughout components ──────────────────────
        'forest-green': '#315C45',   // primary brand (#315C45)
        'terracotta':   '#C47745',   // accent (#C47745)
        'gold':         '#C89B3C',   // warm heritage gold
        'cream':        '#F6F0E5',   // warm cream background (#F6F0E5)
        'charcoal':     '#1E2621',   // primary readable dark text

        // ── Full palettes for shade variants ─────────────────────────────
        forest: {
          50:  '#F2F6F3',
          100: '#E1ECE5',
          200: '#C5DBCF',
          300: '#9EBFAD',
          400: '#6E9D83',
          500: '#477B5E',
          600: '#315C45', // Signature Forest Green (#315C45)
          700: '#274B38',
          800: '#1F3C2C', // Deep forest
          900: '#172E22',
          950: '#0C1A13',
        },
        terracotta: {
          50:  '#FAF4EE',
          100: '#F5E6DC',
          200: '#EBCDB9',
          300: '#DFAe91',
          400: '#D28E63',
          500: '#C47745', // Signature Terracotta (#C47745)
          600: '#B06132',
          700: '#924B23',
          800: '#753A1B',
          900: '#5F2F16',
        },
        sage: {
          50:  '#F4F7F4',
          100: '#E5EDE6',
          200: '#CDDCCD',
          300: '#ACC4AD',
          400: '#89A88B',
          500: '#698B6C',
          600: '#516E54',
          700: '#3F5541',
          800: '#304132',
          900: '#243226',
        },
        gold: {
          50:  '#FDFBF4',
          100: '#FAF3E0',
          200: '#F4E5BD',
          300: '#EBD194',
          400: '#DEB967',
          500: '#C89B3C', // Warm heritage gold
          600: '#AA7F2C',
          700: '#886221',
          800: '#6C4D1D',
          900: '#563D1B',
        },
        cream: {
          50:  '#FCFAF6',
          100: '#FAF6EE',
          200: '#F6F0E5', // Signature Warm Cream (#F6F0E5)
          300: '#ECE2D0',
          400: '#DFD2BA',
          500: '#CEBD9F',
          DEFAULT: '#F6F0E5',
        },
        charcoal: {
          50:  '#F6F7F6',
          100: '#E9EBEA',
          200: '#D4D8D5',
          300: '#B2B9B4',
          400: '#88918A',
          500: '#646E67',
          600: '#4D5650',
          700: '#38403A',
          800: '#272E29',
          900: '#1E2621', // Primary readable text
          DEFAULT: '#1E2621',
        },
      },
      fontFamily: {
        sans:    ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        serif:   ['Playfair Display', 'Georgia', 'serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
