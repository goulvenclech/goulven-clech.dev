import { defineConfig } from "astro/config"
import { inject } from "@vercel/analytics"
import tailwind from "@astrojs/tailwind"
import mdx from "@astrojs/mdx"
import { astroExpressiveCode } from "astro-expressive-code"
import "@fontsource/work-sans"

//  https://www.npmjs.com/package/astro-expressive-code
/** @type {import('astro-expressive-code').AstroExpressiveCodeOptions} */
const astroExpressiveCodeOptions = {
  styleOverrides: {
    borderRadius: "0.5rem",
    codeBackground: "#2E303E",
  },
  frames: {
    styleOverrides: {
      terminalBackground: "#2E303E",
    },
  },
}

// Vercel analytics
inject()

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), astroExpressiveCode(astroExpressiveCodeOptions), mdx()],
  markdown: {
    shikiConfig: {
      theme: "css-variables",
    },
  },
  image: {
    service: {
      entrypoint: "./src/imageService.ts",
    },
  },
})
