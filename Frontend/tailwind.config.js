/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        navy: {
          950: "#050B1A",
          900: "#0A1330",
          850: "#0D1938",
          800: "#101F45",
          700: "#152A5C",
          600: "#1C3A78",
        },
        accent: {
          500: "#2E5CE6",
          600: "#2450D6",
          700: "#1B3FB8",
        },
        surface: {
          50: "#F7F8FA",
          100: "#F1F3F6",
          200: "#E7EAEF",
          300: "#D7DCE3",
        },
        ink: {
          900: "#0F1729",
          700: "#374253",
          500: "#64748B",
          400: "#94A3B8",
        },
        success: {
          50: "#EAFBF1",
          500: "#16A34A",
          600: "#15803D",
        },
        warning: {
          50: "#FFF8EB",
          500: "#D97706",
          600: "#B45309",
        },
        danger: {
          50: "#FEF2F2",
          500: "#DC2626",
          600: "#B91C1C",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 41, 0.06), 0 1px 3px rgba(15, 23, 41, 0.08)",
        panel: "0 8px 24px rgba(10, 19, 48, 0.10)",
      },
      borderRadius: {
        md: "8px",
        lg: "10px",
        xl: "14px",
      },
    },
  },
  plugins: [],
};
