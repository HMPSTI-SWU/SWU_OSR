import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)"],
      },
      colors: {
        // Millennium Science School palette — stark & functional
        millennium: {
          cyan: "#00BCD4",
          "cyan-dark": "#0097A7",
          blue: "#0D47A1",
          black: "#0A0A0A",
          slate: "#1E293B",
          "slate-mid": "#334155",
          white: "#FFFFFF",
          "off-white": "#FAFAFA",
          border: "#E2E8F0",
        },
      },
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
        extrabold: "800",
        black: "900",
      },
      spacing: {
        // Mathematical grid units (base 4px)
        "grid-1": "4px",
        "grid-2": "8px",
        "grid-3": "12px",
        "grid-4": "16px",
        "grid-5": "20px",
        "grid-6": "24px",
        "grid-8": "32px",
        "grid-10": "40px",
        "grid-12": "48px",
        "grid-16": "64px",
      },
    },
  },
  plugins: [],
};

export default config;
