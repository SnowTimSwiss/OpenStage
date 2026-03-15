/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Sora", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        bg: {
          primary: "#090909",
          secondary: "#111111",
          panel: "#171717",
          hover: "#1f1f1f",
        },
        border: "#252525",
        accent: {
          DEFAULT: "#f97316",
          hover: "#ea6c10",
          muted: "#f9731620",
        },
        danger: "#ef4444",
        success: "#22c55e",
      },
    },
  },
  plugins: [],
};
