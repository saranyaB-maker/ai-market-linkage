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
        'forest-green': '#1D452B',   // primary brand
        'terracotta':   '#C85A32',   // accent
        'gold':         '#D4AF37',   // muted gold
        'cream':        '#FAF8F5',   // background
        'charcoal':     '#2B302D',   // primary text

        // ── Full palettes for shade variants ─────────────────────────────
        forest: {
          50:  '#F0F6F2',
          100: '#E0EDE4',
          200: '#C0DBC8',
          300: '#95C2A2',
          400: '#64A477',
          500: '#3D8654',
          600: '#2D6B42',
          700: '#235434',
          800: '#1D452B', // Primary brand
          900: '#173723',
          950: '#0C2013',
        },
        terracotta: {
          50:  '#FDF6F3',
          100: '#FAECE5',
          200: '#F5D7CA',
          300: '#EDBBA7',
          400: '#E19576',
          500: '#D5734E',
          600: '#C85A32', // Accent
          700: '#A74524',
          800: '#893B22',
          900: '#713421',
        },
        gold: {
          50:  '#FDFBF4',
          100: '#FAF4E4',
          200: '#F4E7BF',
          300: '#ECD593',
          400: '#E3C167',
          500: '#D4AF37', // Muted gold
          600: '#B89225',
          700: '#936E1D',
          800: '#77571E',
          900: '#65481E',
        },
        cream: {
          50:  '#FCFBF8',
          100: '#F9F7F1',
          200: '#F3EFE3',
          300: '#EBE4D1',
          400: '#DFD5BC',
          DEFAULT: '#FAF8F5',
        },
        charcoal: {
          50:  '#F6F6F6',
          100: '#E7E7E7',
          200: '#D1D1D1',
          300: '#B0B0B0',
          400: '#888888',
          500: '#6D6D6D',
          600: '#5D5D5D',
          700: '#4F4F4F',
          800: '#2B302D',
          900: '#1F2421', // Primary text
          DEFAULT: '#2B302D',
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
