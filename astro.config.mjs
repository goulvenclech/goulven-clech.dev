import { defineConfig } from "astro/config"
import tailwind from "@astrojs/tailwind"
import mdx from "@astrojs/mdx"
import { astroExpressiveCode } from "astro-expressive-code"
import expressiveCode from "astro-expressive-code"

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

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), astroExpressiveCode(astroExpressiveCodeOptions), mdx()],
  markdown: {
    shikiConfig: {
      theme: "css-variables",
    },
  },
  experimental: {
    assets: true,
  },
  image: {
    service: {
      entrypoint: "./src/imageService.ts",
    },
  },
})
