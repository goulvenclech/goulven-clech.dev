import { defineConfig, envField } from "astro/config"
import mdx from "@astrojs/mdx"
import remarkGfm from "remark-gfm"
import astroExpressiveCode, { ExpressiveCodeTheme } from "astro-expressive-code"
import fs from "node:fs"
import rehypeMermaid from "rehype-mermaid"
import tailwindcss from "@tailwindcss/vite"

import netlify from "@astrojs/netlify"

// Astro Expressive Code - Used to style code blocks
/** @type {import('astro-expressive-code').AstroExpressiveCodeOptions} */
const darkThemeJsoncString = fs.readFileSync(
	new URL(`src/assets/code-dark-theme.jsonc`, import.meta.url),
	"utf-8",
)
const lightThemeJsoncString = fs.readFileSync(
	new URL(`src/assets/code-light-theme.jsonc`, import.meta.url),
	"utf-8",
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
		codeFontFamily: "var(--font-monaspace), ui-monospace, monospace",
		uiFontFamily: "var(--font-monaspace), ui-monospace, monospace",
		codeFontSize: "14px",
		borderRadius: "0.5rem",
	},
}

// https://astro.build/config
export default defineConfig({
	site: "https://goulven-clech.dev",
	integrations: [
		astroExpressiveCode(astroExpressiveCodeOptions),
		mdx({
			remarkPlugins: [remarkGfm],
		}),
	],

	image: {
		service: {
			entrypoint: "./src/imageService.ts",
		},
		domains: [
			"avatars.githubusercontent.com",
			"maps.googleapis.com",
			"places.googleapis.com",
			"lh3.googleusercontent.com",
			"covers.openlibrary.org",
			"m.media-amazon.com",
		],
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
			CATALOGUE_PASSWORD: envField.string({
				context: "client",
				access: "public",
			}),
			IGDB_ID: envField.string({ context: "client", access: "public" }),
			IGDB_SECRET: envField.string({ context: "client", access: "public" }),
			BGG_TOKEN: envField.string({
				context: "client",
				access: "public",
				default: "",
			}),
		},
	},

	vite: {
		plugins: [tailwindcss()],
	},

	adapter: netlify({
		imageCDN: false, // Conflict with our image service
	}),

	experimental: {
		fonts: [
			{
				provider: "local",
				name: "EB Garamond",
				cssVariable: "--font-eb-garamond",
				fallbacks: ["serif"],
				variants: [
					{
						weight: "400 800",
						style: "normal",
						src: [
							"./src/assets/fonts/EB_Garamond/EBGaramond-VariableFont_wght.woff2",
						],
					},
					{
						weight: "400 800",
						style: "italic",
						src: [
							"./src/assets/fonts/EB_Garamond/EBGaramond-Italic-VariableFont_wght.woff2",
						],
					},
				],
			},
			{
				provider: "local",
				name: "Monaspace Neon",
				cssVariable: "--font-monaspace",
				fallbacks: ["monospace"],
				variants: [
					{
						weight: "200 800",
						style: "normal",
						src: ["./src/assets/fonts/Monaspace Neon/Monaspace Neon Var.woff2"],
					},
					{
						weight: "200 800",
						style: "italic",
						src: [
							"./src/assets/fonts/Monaspace Radon/Monaspace Radon Var.woff2",
						],
					},
				],
			},
			{
				provider: "local",
				name: "Abby",
				cssVariable: "--font-abby",
				fallbacks: ["cursive"],
				variants: [
					{
						weight: 400,
						style: "normal",
						src: ["./src/assets/fonts/Abby/AbbyYOFF.woff2"],
					},
				],
			},
		],
	},
})
