// @vitest-environment node
import { describe, expect, it } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import ReviewThumbnailGrid from "../../src/components/catalogue/ReviewThumbnailGrid.astro"

// Mirrors the component's exported ReviewThumbnail (the *.astro test shim only types the default export).
interface ReviewThumbnail {
	source_name: string
	source_img: string
	source_link: string
	rating: number
	detail: string
}

const review: ReviewThumbnail = {
	source_name: "The Witness (2016)",
	source_img: "https://example.com/cover.jpg",
	source_link: "https://www.igdb.com/games/the-witness",
	rating: 5,
	detail: "😍 loved this game, felt love, curious; « Brilliant puzzles. »",
}

async function renderGrid(reviews: ReviewThumbnail[]) {
	const container = await AstroContainer.create()
	return container.renderToString(ReviewThumbnailGrid, { props: { reviews } })
}

describe("ReviewThumbnailGrid", () => {
	it("keeps the cover, alt title, and per-item rating emoji", async () => {
		const html = await renderGrid([review])
		expect(html).toContain('alt="The Witness (2016)"')
		expect(html).toContain('href="https://www.igdb.com/games/the-witness"')
		expect(html).toContain("😍")
	})

	it("exposes the detail to readers via a sr-only span", async () => {
		const html = await renderGrid([review])
		expect(html).toContain(
			'<span class="sr-only">😍 loved this game, felt love, curious; « Brilliant puzzles. »</span>',
		)
	})

	it("mirrors title and detail into data-tooltip for the hover box", async () => {
		const html = await renderGrid([review])
		expect(html).toContain(
			'data-tooltip="The Witness (2016) — 😍 loved this game, felt love, curious; « Brilliant puzzles. »"',
		)
	})

	it("hides the redundant rating emoji from assistive tech", async () => {
		const html = await renderGrid([review])
		expect(html).toMatch(/<span\s+aria-hidden="true"[^>]*>\s*😍\s*<\/span>/)
	})

	it("renders an empty grid without thumbnails", async () => {
		const html = await renderGrid([])
		expect(html).not.toContain("<a")
	})
})
