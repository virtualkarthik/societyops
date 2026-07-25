import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#1e40af", light: "#dbeafe", dark: "#1e3a8a" },
      },
    },
  },
  plugins: [],
} satisfies Config;
