// @vitest-environment node
import { describe, it, expect } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import ColorSwatches from "../../src/components/colophon/ColorSwatches.astro"
import type { ThemeToken } from "../../src/themeTokens"

async function renderSwatches(
	colors: ThemeToken[][],
	ramps?: { name: string; value?: string; colors: string[] }[],
) {
	const container = await AstroContainer.create()
	return container.renderToString(ColorSwatches, { props: { colors, ramps } })
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
		expect(html).not.toContain("<marker-")
		expect(html).not.toContain('fill="url(#texture-')
	})

	it("splits a textured accent into its colour and its texture, after its marker", async () => {
		const html = await renderSwatches([[{ name: "warning", value: "#ff6900" }]])
		expect(paintedColors(html)).toEqual(["#ff6900"])
		expect(html).toContain('fill="url(#texture-warning)"')
		expect(html).toMatch(
			/<strong[^>]*><marker-warning><\/marker-warning>\s*warning/,
		)
	})

	it("paints a ramp as bands under a single label, after the tokens", async () => {
		const html = await renderSwatches(
			[[{ name: "primary", value: "#e95678" }]],
			[
				{
					name: "gradient",
					colors: ["var(--chart-rating-1)", "var(--chart-rating-2)"],
				},
			],
		)
		expect(paintedColors(html)).toEqual([
			"#e95678",
			"var(--chart-rating-1)",
			"var(--chart-rating-2)",
		])
		expect(textOf(html)).toBe("primary #e95678 gradient")
	})

	it("keeps the solid primary unsplit, with its marker", async () => {
		const html = await renderSwatches([[{ name: "primary", value: "#e95678" }]])
		expect(html).not.toContain('fill="url(#texture-')
		expect(html).toMatch(
			/<strong[^>]*><marker-primary><\/marker-primary>\s*primary/,
		)
	})
})
