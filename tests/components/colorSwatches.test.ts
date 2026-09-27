// @vitest-environment node
import { describe, it, expect } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import ColorSwatches from "../../src/components/colophon/ColorSwatches.astro"
import type { ThemeToken } from "../../src/themeTokens"

async function renderSwatches(colors: ThemeToken[][]) {
	const container = await AstroContainer.create()
	return container.renderToString(ColorSwatches, { props: { colors } })
}

function textOf(html: string): string {
	return html
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim()
}

function paintedColors(html: string): string[] {
	return [...html.matchAll(/background-color: ([^;"]+)/g)].map((m) => m[1])
}

describe("ColorSwatches", () => {
	it("paints a single colour and labels it with its token", async () => {
		const html = await renderSwatches([[{ name: "primary", value: "#e95678" }]])
		expect(paintedColors(html)).toEqual(["#e95678"])
		expect(textOf(html)).toBe("primary #e95678")
	})

	it("paints both halves of a pair and labels each with its token", async () => {
		const html = await renderSwatches([
			[
				{ name: "font-light", value: "#262421" },
				{ name: "font-dark", value: "#e8e8e8" },
			],
		])
		expect(paintedColors(html)).toEqual(["#262421", "#e8e8e8"])
		expect(textOf(html)).toBe("font-light #262421 font-dark #e8e8e8")
	})
})
