import { describe, expect, it } from "vitest"
import { weightTrend } from "$src/stats"
import type { WellnessEntry } from "$src/schemas"

const TODAY = "2026-08-19" // a Wednesday, ISO week 2026-W34

const wellness = (
	date: string,
	metrics: { weightKg?: number; steps?: number },
): WellnessEntry => ({
	kind: "wellness",
	schemaVersion: 1,
	id: crypto.randomUUID(),
	date,
	...metrics,
})

describe("weightTrend", () => {
	it("averages a week's readings into one point per ISO week", () => {
		const trend = weightTrend(
			[
				wellness("2026-08-14", { weightKg: 73 }),
				wellness("2026-08-17", { weightKg: 71.5 }),
				wellness("2026-08-19", { weightKg: 72.5 }),
			],
			TODAY,
			2,
		)

		expect(trend.points).toEqual([
			{ week: "2026-W33", value: 73 },
			{ week: "2026-W34", value: 72 },
		])
	})

	it("reports the latest reading itself, not the week it averages into", () => {
		const trend = weightTrend(
			[
				wellness("2026-08-17", { weightKg: 71.5 }),
				wellness("2026-08-19", { weightKg: 72.5 }),
			],
			TODAY,
			2,
		)

		expect(trend.latest).toEqual({ date: "2026-08-19", kg: 72.5 })
	})

	it("leaves a week without a weigh-in empty rather than carried over", () => {
		const trend = weightTrend(
			[wellness("2026-08-14", { weightKg: 73 })],
			TODAY,
			2,
		)
		expect(trend.points.map((point) => point.value)).toEqual([73, null])
	})

	it("ignores readings older than the window, latest included", () => {
		const trend = weightTrend(
			[wellness("2026-06-01", { weightKg: 80 })],
			TODAY,
			2,
		)
		expect(trend.latest).toBeNull()
		expect(trend.points.every((point) => point.value === null)).toBe(true)
	})

	it("ignores wellness entries carrying no weight", () => {
		const trend = weightTrend(
			[wellness("2026-08-18", { steps: 9000 })],
			TODAY,
			2,
		)
		expect(trend.latest).toBeNull()
	})

	it("counts a same-day duplicate once, the same way on every device", () => {
		const monday = wellness("2026-08-17", { weightKg: 75 })
		const low = { ...wellness("2026-08-19", { weightKg: 71 }), id: "a" }
		const high = { ...wellness("2026-08-19", { weightKg: 73 }), id: "b" }

		for (const log of [
			[monday, low, high],
			[monday, high, low],
		]) {
			const trend = weightTrend(log, TODAY, 2)
			expect(trend.latest).toEqual({ date: "2026-08-19", kg: 73 })
			expect(trend.points.at(-1)?.value).toBe(74)
		}
	})
})
