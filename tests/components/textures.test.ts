// @vitest-environment node
import { describe, it, expect } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import Textures from "../../src/components/images/Textures.astro"
import { textureIds } from "../../src/markers"

describe("Textures", () => {
	it("defines each accent's texture in that accent's colour", async () => {
		const container = await AstroContainer.create()
		const html = await container.renderToString(Textures)
		const patterns = [
			...html.matchAll(/<pattern[^>]*id="([^"]+)"[^>]*>(.*?)<\/pattern>/gs),
		].map(([, id, body]) => [id, body.match(/var\(--color-(\w+)\)/)?.[1]])
		expect(Object.fromEntries(patterns)).toEqual(
			Object.fromEntries(
				Object.entries(textureIds).map(([variant, id]) => [id, variant]),
			),
		)
	})

	it("keeps the definitions out of the accessibility tree", async () => {
		const container = await AstroContainer.create()
		const html = await container.renderToString(Textures)
		expect(html).toMatch(/^<svg[^>]*aria-hidden="true"/)
	})
})
