import { describe, expect, it } from "vitest"
import { renderStatsMd, type StatsView } from "$src/pages/stats.md"

const SITE = "https://example.com"

const emptyTrend = { points: [], average: null }

function view(overrides: Partial<StatsView>): StatsView {
	return {
		site: SITE,
		attendance: { done: 12, planned: 14, ratio: 12 / 14 },
		sleep: emptyTrend,
		steps: emptyTrend,
		trends: [],
		tonnage: [
			{ week: "2026-W33", value: 1240 },
			{ week: "2026-W34", value: 0 },
		],
		...overrides,
	}
}

describe("renderStatsMd", () => {
	it("renders adherence as a percentage over scheduled sessions", () => {
		expect(renderStatsMd(view({}))).toContain("86% — 12/14 scheduled sessions.")
	})

	it("renders a wellness average with its daily series", () => {
		const sleep = {
			points: [
				{ date: "2026-08-15", value: 7.5 },
				{ date: "2026-08-16", value: null },
				{ date: "2026-08-17", value: 6.8 },
			],
			average: (7.5 + 6.8) / 2,
		}
		expect(renderStatsMd(view({ sleep }))).toContain(
			"- Sleep: 7.2 h average over 2 logged days. Daily (2026-08-15 → 2026-08-17): 7.5 · — · 6.8",
		)
	})

	it("falls back to the empty wellness and 1RM states", () => {
		const document = renderStatsMd(view({}))
		expect(document).toContain("- Sleep: No sleep logged yet.")
		expect(document).toContain("- Steps: No steps logged yet.")
		expect(document).toContain("No sets logged yet.")
	})

	it("renders a 1RM trend with halved-kg rounding and weekly series", () => {
		const trends = [
			{
				ref: "back-squat",
				exercise: {
					name: "Back squat",
					main: true,
					direction: "ascending" as const,
				},
				points: [
					{ week: "2026-W33", value: 77.3 },
					{ week: "2026-W34", value: null },
				],
			},
		]
		expect(renderStatsMd(view({ trends }))).toContain(
			"- Back squat: latest 77.5 kg. Weekly best (2026-W33 → 2026-W34): 77.5 · —",
		)
	})

	it("renders the weekly tonnage series", () => {
		expect(renderStatsMd(view({}))).toContain(
			"Total kg per week (2026-W33 → 2026-W34): 1240 · 0",
		)
	})
})
