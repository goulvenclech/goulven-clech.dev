const defaultTheme = require("tailwindcss/defaultTheme")

/** @type {import('tailwindcss').Config} */
module.exports = {
  // See -> https://tailwindcss.com/docs/dark-mode
  darkMode: "class",
  // See -> https://docs.astro.build/en/guides/integrations-guide/tailwind/
  content: ["./src/**/*.{astro,mdx,ts,js}"],
  theme: {
    /**
     * Blog custom sizes 📏
     * Our base size is 18px (1.125rem) and we use a 1.5 ratio
     * I try to limit the number of sizes as possible
     * See -> https://tailwindcss.com/docs/font-size#customizing-your-theme
     */
    fontSize: {
      xs: "14px", // 0.875rem
      sm: "16px", // 1rem
      base: "18px", // 1.125rem
      lg: "24px", // 1.5rem
      xl: "32px", // 2.25rem
    },
    /**
     * Blog custom colors 🎨
     * I try to limit the number of colors as possible
     * Inspired by -> https://horizontheme.netlify.app/
     * See -> https://tailwindcss.com/docs/customizing-colors
     * use dark or light version depending on the theme
     */
    colors: {
      // Document default for background
      body: {
        light: "#FFFCFB",
        dark: "#1C1E26",
      },
      // Same as body but inverted for text
      font: {
        light: "#1C1E26",
        dark: "#FFFCFB",
      },
      // Alt body color for background, used for hover
      alt: {
        light: "#FFEDE6",
        dark: "#2E303E",
      },
      // Mainly used when hovering buttons or links
      // stay the same in light and dark mode
      primary: "#EC6A88",
    },
    // limit the number of font weights as possible
    fontWeight: {
      normal: "400",
      bold: "600",
    },
    extend: {
      fontFamily: {
        // I like Source Serif 4, it's a serif font but not too serious
        // Also, it's has small caps, witch is nice.
        sans: ['"Source Serif 4 Variable"', '"Source Serif 4"', ...defaultTheme.fontFamily.serif],
      },
      spacing: {
        18: "4.5rem",
      },
    },
  },
}
