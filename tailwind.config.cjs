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
      xs: "16px",
      sm: "18px",
      base: "20px",
      lg: "24px",
      xl: "28px",
      "2xl": "40px",
    },
    /**
     * Blog custom colors 🎨
     * I try to limit the number of colors as possible
     * Inspired by -> https://horizontheme.netlify.app/
     * See -> https://tailwindcss.com/docs/customizing-colors
     * use dark or light version depending on the theme
     */
    colors: {
      font: {
        light: "#1C1E26",
        dark: "#f4f4f5",
      },
      // Document default for background
      body: {
        light: "#fff",
        dark: "#1C1E26",
      },
      // Alt body color for background, used for hover
      alt: {
        light: "#f4f4f5",
        dark: "#2E303E",
      },
      // Mainly used when hovering buttons or links
      // stay the same in light and dark mode
      primary: "#E95678",
    },
    // limit the number of font weights as possible
    fontWeight: {
      normal: "400",
      bold: "600",
    },
    extend: {
      fontFamily: {
        // Self hosted. See base.css for the font-face declaration
        // Cormorant is an elegant and complete Garamond display font, but too light for body text (free)
        display: ['"Cormorant", "EB Garamond", "Source Serif 4"', ...defaultTheme.fontFamily.serif],
        // EB Garamond is a beautiful and complete Garamond font, fidelity to the original (free)
        serif: ['"EB Garamond", "Cormorant", "Source Serif 4"', ...defaultTheme.fontFamily.serif],
        // Iosevka is a monospace font with a lot of ligatures and a good readability (free)
        mono: ["Iosevka", ...defaultTheme.fontFamily.mono],
        // Abby is a handwritten font, used for personal annotations (paid)
        goofy: ["Abby", ...defaultTheme.fontFamily.sans],
      },
      spacing: {
        18: "4.5rem",
      },
    },
  },
}
