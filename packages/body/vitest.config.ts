import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		alias: {
			"$src/": new URL("./src/", import.meta.url).pathname,
		},
	},
})
