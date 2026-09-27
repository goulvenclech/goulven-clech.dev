// @vitest-environment node
import { describe, it, expect } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import TypeSpecimens from "../../src/components/colophon/TypeSpecimens.astro"
import type { TextSizeToken, ThemeToken } from "../../src/themeTokens"

async function renderSpecimens({
	fontFamilies = [],
	textSizes = [],
}: {
	fontFamilies?: ThemeToken[]
	textSizes?: TextSizeToken[]
}) {
	const container = await AstroContainer.create()
	return container.renderToString(TypeSpecimens, {
		props: { fontFamilies, textSizes },
	})
}

describe("TypeSpecimens", () => {
	it("labels each family sample with its font and sets it in that stack", async () => {
		const html = await renderSpecimens({
			fontFamilies: [
				{ name: "EB Garamond", value: "var(--font-eb-garamond), serif" },
			],
		})
		expect(html).toMatch(/>\s*EB Garamond\s*</)
		expect(html).toContain("font-family: var(--font-eb-garamond), serif")
	})

	it("sizes each sample with its size and line height, labelled by size", async () => {
		const html = await renderSpecimens({
			textSizes: [
				{ name: "xs", value: "14px", lineHeight: "20px" },
				{ name: "2xl", value: "30px", lineHeight: null },
			],
		})
		expect(html).toContain("font-size: 14px; line-height: 20px")
		expect(html).toContain("font-size: 30px; line-height: normal")
		expect(html).toMatch(/>\s*14px\s*</)
		expect(html).not.toMatch(/>\s*text-xs\s*</)
	})
})
