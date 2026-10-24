import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep teal brand on warm neutrals. `gray` is remapped to Tailwind's warm `stone`
        // so every existing gray-* class picks up the warmer tone.
        brand: { DEFAULT: "#0f766e", light: "#ccfbf1", dark: "#115e59", tint: "#f0fdfa" },
        gray: colors.stone,
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
} satisfies Config;
