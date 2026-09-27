import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parseThemeTokens } from "../src/themeTokens"

describe("parseThemeTokens", () => {
	it("pairs light and dark colours, in declaration order", () => {
		const { colors } = parseThemeTokens(`
			@theme {
				--color-font-light: #262421;
				--color-font-dark: #e8e8e8;
				--color-primary: #e95678;
				--color-success: oklch(59.6% 0.145 163.225);
			}
		`)
		expect(colors).toEqual([
			[
				{ name: "font-light", value: "#262421" },
				{ name: "font-dark", value: "#e8e8e8" },
			],
			[{ name: "primary", value: "#e95678" }],
			[{ name: "success", value: "oklch(59.6% 0.145 163.225)" }],
		])
	})

	it("lists the light half of a pair first", () => {
		const { colors } = parseThemeTokens(`
			@theme {
				--color-body-dark: #1c1e26;
				--color-body-light: #fff;
			}
		`)
		expect(colors).toEqual([
			[
				{ name: "body-light", value: "#fff" },
				{ name: "body-dark", value: "#1c1e26" },
			],
		])
	})

	it("keeps a light or dark colour without counterpart on its own", () => {
		const { colors } = parseThemeTokens(`
			@theme {
				--color-shadow-dark: #000;
				--color-paper-light: #fff;
			}
		`)
		expect(colors).toEqual([
			[{ name: "shadow-dark", value: "#000" }],
			[{ name: "paper-light", value: "#fff" }],
		])
	})

	it("keeps font weights out of the font families", () => {
		const tokens = parseThemeTokens(`
			@theme {
				--font-weight-*: initial;
				--font-weight-medium: 525;
				--font-serif:
					var(--font-eb-garamond), "Source Serif 4",
					serif;
			}
		`)
		expect(tokens.fontFamilies).toEqual([
			{
				name: "serif",
				value: 'var(--font-eb-garamond), "Source Serif 4", serif',
			},
		])
	})

	it("skips the feature and variation settings of font families", () => {
		const { fontFamilies } = parseThemeTokens(`
			@theme {
				--font-serif: Georgia, serif;
				--font-serif--font-feature-settings: "liga", "clig", "onum";
				--font-serif--font-variation-settings: "opsz" 32;
			}
		`)
		expect(fontFamilies.map(({ name }) => name)).toEqual(["serif"])
	})

	it("folds line heights into text sizes", () => {
		const { textSizes } = parseThemeTokens(`
			@theme {
				--text-*: initial;
				--text-xs: 14px;
				--text-xs--line-height: 20px;
				--text-xs--letter-spacing: 0.01em;
				--text-2xl: 30px;
			}
		`)
		expect(textSizes).toEqual([
			{ name: "xs", value: "14px", lineHeight: "20px" },
			{ name: "2xl", value: "30px", lineHeight: null },
		])
	})

	it("keeps text shadows out of the text sizes", () => {
		const { textSizes } = parseThemeTokens(`
			@theme {
				--text-sm: 16px;
				--text-shadow-sm: 0 1px 2px rgb(0 0 0 / 0.1);
			}
		`)
		expect(textSizes.map(({ name }) => name)).toEqual(["sm"])
	})

	it("reads every @theme block and nothing else", () => {
		const { colors } = parseThemeTokens(`
			@custom-variant dark (&:is(.dark *));
			:root { --color-outside: red; }
			@theme inline {
				/* --color-commented: blue; } */
				--color-accent: #abc;
				@keyframes wiggle { 50% { transform: rotate(3deg); } }
				--color-after-keyframes: #def;
			}
			@media (width >= theme(--breakpoint-xl)) { a { --color-media: green; } }
			@theme { --color-second-block: #123; }
		`)
		expect(colors.flat().map(({ name }) => name)).toEqual([
			"accent",
			"after-keyframes",
			"second-block",
		])
	})

	it("lets a later declaration override an earlier one", () => {
		const { colors } = parseThemeTokens(`
			@theme {
				--color-font-light: #000;
				--color-font-dark: #e8e8e8;
				--color-primary: red;
			}
			@theme {
				--color-font-light: #262421;
				--color-primary: #e95678;
			}
		`)
		expect(colors).toEqual([
			[
				{ name: "font-light", value: "#262421" },
				{ name: "font-dark", value: "#e8e8e8" },
			],
			[{ name: "primary", value: "#e95678" }],
		])
	})

	it("lets initial remove a token declared before it", () => {
		const { colors } = parseThemeTokens(`
			@theme {
				--color-primary: #e95678;
				--color-stale: red;
				--color-stale: initial;
			}
		`)
		expect(colors.flat().map(({ name }) => name)).toEqual(["primary"])
	})

	it("lets a namespace reset clear its earlier tokens", () => {
		const tokens = parseThemeTokens(`
			@theme {
				--color-stale: red;
				--font-stale: serif;
			}
			@theme {
				--color-*: initial;
				--font-*: initial;
				--color-primary: #e95678;
			}
		`)
		expect(tokens.colors.flat().map(({ name }) => name)).toEqual(["primary"])
		expect(tokens.fontFamilies).toEqual([])
	})

	it("reads the tokens of the site's own stylesheet", () => {
		const css = readFileSync(
			resolve(import.meta.dirname, "../src/assets/base.css"),
			"utf8",
		)
		const tokens = parseThemeTokens(css)
		expect(tokens.colors.some((shades) => shades.length === 2)).toBe(true)
		expect(tokens.fontFamilies).not.toHaveLength(0)
		expect(tokens.textSizes).not.toHaveLength(0)
	})
})
