/** @type {import('tailwindcss').Config} */
module.exports = {
  // Indica a Tailwind qué archivos van a usar clases
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};