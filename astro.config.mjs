import { defineConfig } from "astro/config"

// https://astro.build/config
import tailwind from "@astrojs/tailwind"

// https://astro.build/config
import mdx from "@astrojs/mdx"

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), mdx()],
  markdown: { shikiConfig: { theme: "css-variables" } },
  experimental: { assets: true },
  image: {
    service: "./src/imageService.ts",
  },
})
