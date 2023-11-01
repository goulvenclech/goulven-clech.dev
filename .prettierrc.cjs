/** @type {import("@types/prettier").Options} */
module.exports = {
  printWidth: 100,
  tabWidth: 2,
  trailingComma: "es5",
  semi: false,
  plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  astroAllowShorthand: false,
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
  ],
}
