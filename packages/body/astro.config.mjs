import { defineConfig, fontProviders } from "astro/config"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
	site: "https://body.goulven-clech.dev",

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
