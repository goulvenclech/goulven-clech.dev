/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        body: {
          light: "#FDF0ED",
          dark: "#1C1E26",
        },
        body2: {
          light: "#FADAD1",
        },
        base: {
          light: "#1C1E26",
          dark: "#FDF0ED",
        },
        primary: {
          light: "#EC6A88",
          dark: "#E95678",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/line-clamp")],
}
