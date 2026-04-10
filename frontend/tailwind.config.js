/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'mono': ['Courier New', 'monospace'],
        'sans-bold': ['Arial', 'sans-serif']
      },
      colors: {
        'base': '#f5f5f5',
        'contrast': '#000000',
        'accent': '#ff6600'
      },
      borderWidth: {
        '2': '2px'
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem'
      },
      cursor: {
        'crosshair': 'crosshair'
      },
      transitionDuration: {
        '0': '0ms'
      }
    },
  },
  plugins: [],
}
