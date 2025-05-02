import { defineConfig, envField } from "astro/config"
import mdx from "@astrojs/mdx"
import astroExpressiveCode, { ExpressiveCodeTheme } from "astro-expressive-code"
import fs from "node:fs"
import rehypeMermaid from "rehype-mermaid"
import tailwindcss from "@tailwindcss/vite"

import netlify from "@astrojs/netlify"

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
  frames: {
    showCopyToClipboardButton: false,
  },
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

// https://astro.build/config
export default defineConfig({
  site: "https://goulven-clech.dev",
  integrations: [astroExpressiveCode(astroExpressiveCodeOptions), mdx()],

  image: {
    service: {
      entrypoint: "./src/imageService.ts",
    },
    domains: ["avatars.githubusercontent.com"],
  },

  markdown: {
    rehypePlugins: [[rehypeMermaid, { strategy: "img-svg", dark: true }]],
  },

  env: {
    schema: {
      WEBSITE_URL: envField.string({
        context: "client",
        access: "public",
        default: "http://localhost:4321/",
      }),
      MAPS_TOKEN: envField.string({ context: "client", access: "public" }),
      GITHUB_TOKEN: envField.string({ context: "client", access: "public" }),
      TURSO_TOKEN: envField.string({ context: "client", access: "public" }),
      TURSO_URL: envField.string({ context: "client", access: "public" }),
      CATALOGUE_PASSWORD: envField.string({ context: "client", access: "public" }),
      IGDB_ID: envField.string({ context: "client", access: "public" }),
      IGDB_SECRET: envField.string({ context: "client", access: "public" }),
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: netlify({
    imageCDN: false, // Conflict with our image service
  }),
})
