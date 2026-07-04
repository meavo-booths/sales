import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@meavo/navigation/dist/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdf4",
          100: "#d1f4e0",
          500: "#30A46C",
          600: "#30A46C",
          700: "#0C8F61",
        },
      },
    },
  },
  plugins: [],
};

export default config;
