import { defineConfig } from "astro/config"
import { inject } from "@vercel/analytics"
import tailwind from "@astrojs/tailwind"
import mdx from "@astrojs/mdx"
import astroExpressiveCode, { ExpressiveCodeTheme } from "astro-expressive-code"
import fs from "node:fs"

// Import code themes from JSONC files to be used by astro-expressive-code
//  https://www.npmjs.com/package/astro-expressive-code
/** @type {import('astro-expressive-code').AstroExpressiveCodeOptions} */
const darkThemeJsoncString = fs.readFileSync(
  new URL(`src/assets/code-dark-theme.jsonc`, import.meta.url),
  "utf-8"
)
const lightThemeJsoncString = fs.readFileSync(
  new URL(`src/assets/code-light-theme.jsonc`, import.meta.url),
  "utf-8"
)
const myDarkTheme = ExpressiveCodeTheme.fromJSONString(darkThemeJsoncString)
const myLightTheme = ExpressiveCodeTheme.fromJSONString(lightThemeJsoncString)

const astroExpressiveCodeOptions = {
  themes: [myDarkTheme, myLightTheme],
  useDarkModeMediaQuery: false,
  styleOverrides: {
    frames: {
      frameBoxShadowCssValue: "0",
    },
    codeFontFamily: "Iosevka",
    uiFontFamily: "Source Serif 4",
    codeFontSize: "14px",
    borderRadius: "0.5rem",
  },
}

// Vercel analytics
inject()

// https://astro.build/config
export default defineConfig({
  site: "https://goulven-clech.dev",
  integrations: [tailwind(), astroExpressiveCode(astroExpressiveCodeOptions), mdx()],
  image: {
    service: {
      entrypoint: "./src/imageService.ts",
    },
  },
})
