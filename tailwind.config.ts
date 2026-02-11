import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "sv-dark": "#0a0a0f",
        "sv-card": "#13131a",
        "sv-accent": "#8b5cf6",
        "sv-red": "#ef4444",
        "sv-green": "#22c55e",
        "sv-gold": "#fbbf24",
        "sv-impostor": "#dc2626",
        "sv-detective": "#3b82f6",
        "sv-citizen": "#6b7280",
      },
    },
  },
  plugins: [],
};

export default config;
