/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{tsx,ts}"],
  theme: {
    extend: {
      colors: {
        abyss: "#082032",
        ocean: "#155e75",
        aqua: "#67e8f9",
        sand: "#f0d9a7",
      },
      boxShadow: {
        glow: "0 24px 80px rgba(103, 232, 249, 0.16)",
      },
    },
  },
  plugins: [],
};
