import { defineConfig, envField, fontProviders } from "astro/config"
import tailwindcss from "@tailwindcss/vite"
import netlify from "@astrojs/netlify"

export default defineConfig({
	site: "https://body.goulven-clech.dev",

	// Every screen reads the database per request, so nothing is prerendered.
	output: "server",
	adapter: netlify(),

	env: {
		schema: {
			TURSO_URL: envField.string({ context: "server", access: "secret" }),
			TURSO_TOKEN: envField.string({ context: "server", access: "secret" }),
			BODY_PASSWORD: envField.string({ context: "server", access: "secret" }),
		},
	},

	vite: {
		plugins: [tailwindcss()],
		resolve: {
			alias: {
				$src: new URL("./src", import.meta.url).pathname,
				$assets: new URL("./src/assets", import.meta.url).pathname,
			},
		},
	},

	fonts: [
		{
			// Fetched at build time and self-hosted, so the deployed site never
			// calls Google at runtime.
			provider: fontProviders.google(),
			name: "Inter",
			cssVariable: "--font-inter",
			fallbacks: ["system-ui", "sans-serif"],
			weights: ["100 900"],
			styles: ["normal"],
		},
	],
})
