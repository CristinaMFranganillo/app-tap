/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          yellow: '#D4E600',
          dark:   '#1A1A1A',
        },
        surface: '#F5F5F5',
        success: '#22C55E',
        danger:  '#EF4444',
      },
    },
  },
  plugins: [],
}
