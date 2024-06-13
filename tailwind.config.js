/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index/*.{html,js}",
    "./list/*.{html,js}",
    "./404/*.{html,js}",
    "./checklists/*.{html,js}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
}