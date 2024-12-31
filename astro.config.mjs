import { defineConfig, envField } from "astro/config"
import { inject } from "@vercel/analytics"
import tailwind from "@astrojs/tailwind"
import mdx from "@astrojs/mdx"
import astroExpressiveCode, { ExpressiveCodeTheme } from "astro-expressive-code"
import fs from "node:fs"

// Astro Expressive Code - Used to style code blocks
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
  themes: [myDarkTheme, myLightTheme, "github-dark", "github-light"],
  useDarkModeMediaQuery: false,
  styleOverrides: {
    frames: {
      frameBoxShadowCssValue: "0",
    },
    codeFontFamily: "Iosevka",
    uiFontFamily: "Iosevka",
    codeFontSize: "14px",
    borderRadius: "0.5rem",
  },
}

// Vercel analytics - I need to get rid of this... Or Vercel as a whole
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
	env: {
    schema: {
      WEBSITE_URL: envField.string({ context: "client", access: "public", default: "http://localhost:4321/"}),
      MAPS_TOKEN: envField.string({ context: "client", access: "public"}),
      GITHUB_TOKEN: envField.string({ context: "client", access: "public"}),
    }
  }
})
