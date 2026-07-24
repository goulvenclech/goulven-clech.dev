// @vitest-environment node
import { describe, it, expect, vi } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import type { ReviewFact } from "../../src/catalogueStats"

/**
 * RatingsBySourceChart distinguishes "the fetch degraded to []" (default
 * unavailable message) from "the fetch succeeded but this period has no
 * reviews" (explicit empty-period message). Mock only `getReviewFacts`,
 * keeping the real pivots, and check which message reaches the markup.
 */
const state = vi.hoisted(() => ({ facts: [] as ReviewFact[] }))

vi.mock("$src/catalogueStats", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../../src/catalogueStats")>()
	return {
		...actual,
		getReviewFacts: vi.fn(async () => state.facts),
	}
})

import RatingsBySourceChart from "../../src/components/catalogue/RatingsBySourceChart.astro"

const EMPTY_PERIOD_MESSAGE = "No reviews in this period yet."
const UNAVAILABLE_MESSAGE =
	"Catalogue stats are unavailable — check back after the next build."

async function render(period?: string) {
	const container = await AstroContainer.create()
	return container.renderToString(RatingsBySourceChart, {
		props: { period },
	})
}

describe("RatingsBySourceChart no-data messages", () => {
	it("shows the empty-period message when facts exist outside the period", async () => {
		state.facts = [{ period: "2025", source: "IGDB", rating: 5, count: 3 }]
		const html = await render("2030")
		expect(html).toContain(EMPTY_PERIOD_MESSAGE)
		expect(html).not.toContain(UNAVAILABLE_MESSAGE)
	})

	it("falls back to the unavailable message when the fetch degraded to []", async () => {
		state.facts = []
		const html = await render("2030")
		expect(html).toContain(UNAVAILABLE_MESSAGE)
		expect(html).not.toContain(EMPTY_PERIOD_MESSAGE)
	})
})
