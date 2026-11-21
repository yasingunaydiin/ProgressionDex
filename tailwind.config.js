/** @type {import('tailwindcss').Config} */
module.exports = {
  corePlugins: {
    preflight: false,
  },
  content: ["./*.{html,js}", "./list/*.{html,js}", "./404/*.{html,js}", "./checklists/*.html", "./checklists/js/*.js"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
};
