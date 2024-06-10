/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index/*.{html,js}"],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
}