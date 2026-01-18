import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist", ".astro"],
    setupFiles: ["./tests/setup.ts"],
    environment: "happy-dom",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.astro", "src/content/**", "src/assets/**"],
    },
    globals: true,
    alias: {
      "$components/": new URL("./src/components/", import.meta.url).pathname,
      "$layouts/": new URL("./src/layouts/", import.meta.url).pathname,
      "$assets/": new URL("./src/assets/", import.meta.url).pathname,
    },
  },
})
