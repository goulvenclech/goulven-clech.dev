/** @type {import('tailwindcss').Config} */
module.exports = {
  // See -> https://tailwindcss.com/docs/dark-mode
  darkMode: "class",
  // See -> https://docs.astro.build/en/guides/integrations-guide/tailwind/
  content: ["./src/**/*.{astro,mdx,ts,tsx}"],
  theme: {
    /**
     * Blog custom colors 🎨
     * See -> https://tailwindcss.com/docs/customizing-colors
     */
    colors: {
      // Document default body color
      body: {
        light: "#FDF0ED",
        dark: "#1C1E26",
      },
      // Alt body color, for example when a div is hovered
      highlight: {
        light: "#FADAD1",
        dark: "#2E303E",
      },
      // Mainly used by text and icons
      base: {
        light: "#1C1E26",
        dark: "#FDF0ED",
      },
      // Mainly used when hovering buttons or links
      primary: "#EC6A88",
    },
    extend: {
      /**
       * Cause Tailwind just offer 2 & 4 for some reason 🤷‍♂️
       * See -> https://tailwindcss.com/docs/text-underline-offset
       */
      textUnderlineOffset: {
        3: "3px",
      },
    },
  },
  // Mainly used for src/components/Card.astro
  // see ->  https://github.com/tailwindlabs/tailwindcss-line-clamp
  plugins: [require("@tailwindcss/line-clamp")],
}
