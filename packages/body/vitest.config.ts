import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		alias: {
			"$src/": new URL("./src/", import.meta.url).pathname,
			"astro:env/server": new URL(
				"./tests/__mocks__/astro-env.ts",
				import.meta.url,
			).pathname,
		},
	},
})
