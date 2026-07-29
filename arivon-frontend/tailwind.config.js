/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens for Arivon — deep indigo/violet as the primary
        // action color (matching the Sparkle/iSchool references), warm
        // amber reserved for highlights/warnings, deep navy for the sidebar.
        brand: {
          50: "#F0EFFE",
          100: "#E0DEFD",
          500: "#6D5BFF",
          600: "#5B45F0",
          700: "#4B37D6",
        },
        navy: {
          800: "#1E1B33",
          900: "#151329",
        },
        amber: {
          500: "#D97706",
          600: "#B45F04",
        },
        slate: {
          50: "#F8F9FB",
          100: "#F1F3F6",
          200: "#E4E7EC",
          600: "#475467",
          800: "#1D2939",
          900: "#101828",
        },
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
