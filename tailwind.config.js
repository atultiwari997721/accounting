/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '360px',
      },
      aspectRatio: {
        'mobile-tall': '9 / 19.5',
      }
    },
  },
  plugins: [],
}
