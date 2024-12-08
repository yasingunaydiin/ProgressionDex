/** @type {import('tailwindcss').Config} */
module.exports = {
  corePlugins: {
    preflight: false,
  },
  content: ["./*.{html,js}", "./list/*.{html,js}", "./404/*.{html,js}", "./checklists/*.{html,js}", "./login/*.{html,js}", "./register/*.{html,js}"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui"), "@tailwindcss/forms"],
};
