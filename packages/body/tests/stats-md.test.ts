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
		weight: { latest: null, points: [] },
		trends: [],
		tonnage: [
			{ week: "2026-W33", value: 1240 },
			{ week: "2026-W34", value: 0 },
		],
		...overrides,
	}
}

describe("renderStatsMd", () => {
	it("mirrors the page's sections, in order", () => {
		expect(
			renderStatsMd(view({}))
				.split("\n")
				.filter((line) => line.startsWith("## ")),
		).toEqual([
			"## Adherence",
			"## Wellness",
			"## Estimated 1RM (Epley)",
			"## Weekly tonnage",
		])
	})

	it("renders adherence as a percentage over scheduled sessions", () => {
		expect(renderStatsMd(view({}))).toContain(
			"86% — 12 of the last 14 scheduled sessions.",
		)
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
			"- Sleep: 7 h 09 average over 2 logged days. Daily (2026-08-15 → 2026-08-17): 7 h 30 · — · 6 h 48",
		)
	})

	it("names the unit on the average, not on every daily point", () => {
		const steps = {
			points: [
				{ date: "2026-08-16", value: 9000 },
				{ date: "2026-08-17", value: 8432 },
			],
			average: (9000 + 8432) / 2,
		}
		expect(renderStatsMd(view({ steps }))).toContain(
			"- Steps: 8716 steps average over 2 logged days. Daily (2026-08-16 → 2026-08-17): 9000 · 8432",
		)
	})

	it("renders the latest weigh-in with its weekly averages", () => {
		const weight = {
			latest: { date: "2026-08-19", kg: 72.5 },
			points: [
				{ week: "2026-W33", value: 73 },
				{ week: "2026-W34", value: 72 },
			],
		}
		expect(renderStatsMd(view({ weight }))).toContain(
			"- Weight: latest 72.5 kg on 2026-08-19. Weekly average (2026-W33 → 2026-W34): 73.0 · 72.0",
		)
	})

	it("falls back to the empty wellness, weight and 1RM states", () => {
		const document = renderStatsMd(view({}))
		expect(document).toContain("- Sleep: No sleep logged yet.")
		expect(document).toContain("- Steps: No steps logged yet.")
		expect(document).toContain("- Weight: No weight logged yet.")
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
