import { describe, expect, it } from "vitest"
import { adherence, dailyWellnessTrend } from "$src/stats"
import {
	wellnessEntrySchema,
	type WeeklyPlan,
	type WellnessEntry,
} from "$src/schemas"

const TODAY = "2026-08-19"

const wellness = (
	date: string,
	metrics: { sleepHours?: number; steps?: number; weightKg?: number },
): WellnessEntry => ({
	kind: "wellness",
	schemaVersion: 1,
	id: crypto.randomUUID(),
	date,
	...metrics,
})

describe("dailyWellnessTrend", () => {
	it("windows one point per day ending yesterday, averaging logged days only", () => {
		const trend = dailyWellnessTrend(
			[
				wellness("2026-08-18", { sleepHours: 7.5 }),
				wellness("2026-08-16", { sleepHours: 6 }),
				wellness("2026-08-01", { sleepHours: 4 }), // outside the window
			],
			"sleepHours",
			TODAY,
			5,
		)

		expect(trend.points).toEqual([
			{ date: "2026-08-14", value: null },
			{ date: "2026-08-15", value: null },
			{ date: "2026-08-16", value: 6 },
			{ date: "2026-08-17", value: null },
			{ date: "2026-08-18", value: 7.5 },
		])
		expect(trend.average).toBeCloseTo((6 + 7.5) / 2, 10)
	})

	it("tracks each metric on its own days", () => {
		const log = [
			wellness("2026-08-18", { steps: 9000 }),
			wellness("2026-08-17", { sleepHours: 7 }),
		]

		const sleep = dailyWellnessTrend(log, "sleepHours", TODAY, 5)
		const steps = dailyWellnessTrend(log, "steps", TODAY, 5)

		expect(sleep.points.map((point) => point.value)).toEqual([
			null,
			null,
			null,
			7,
			null,
		])
		expect(sleep.average).toBe(7)
		expect(steps.points.map((point) => point.value)).toEqual([
			null,
			null,
			null,
			null,
			9000,
		])
		expect(steps.average).toBe(9000)
	})

	it("has no average when nothing is logged", () => {
		const trend = dailyWellnessTrend([], "steps", TODAY, 5)
		expect(trend.average).toBeNull()
		expect(trend.points.every((point) => point.value === null)).toBe(true)
	})

	it("keeps today out: its wellness can only be logged tomorrow", () => {
		const trend = dailyWellnessTrend(
			[wellness(TODAY, { steps: 100 })],
			"steps",
			TODAY,
			5,
		)
		expect(trend.points.every((point) => point.value === null)).toBe(true)
	})

	it("reads past a weigh-in sharing the day, which carries neither metric", () => {
		const slept = {
			...wellness("2026-08-18", { sleepHours: 7.5, steps: 9000 }),
			id: "a",
		}
		const weighed = { ...wellness("2026-08-18", { weightKg: 72.4 }), id: "z" }

		const last = (metric: "sleepHours" | "steps") =>
			dailyWellnessTrend([slept, weighed], metric, TODAY, 5).points.at(-1)
		expect(last("sleepHours")).toEqual({ date: "2026-08-18", value: 7.5 })
		expect(last("steps")).toEqual({ date: "2026-08-18", value: 9000 })
	})

	it("resolves same-day duplicates the same way on every device", () => {
		const low = { ...wellness("2026-08-18", { sleepHours: 6 }), id: "a" }
		const high = { ...wellness("2026-08-18", { sleepHours: 8 }), id: "b" }

		const value = (log: WellnessEntry[]) =>
			dailyWellnessTrend(log, "sleepHours", TODAY, 5).points.at(-1)?.value
		expect(value([low, high])).toBe(8)
		expect(value([high, low])).toBe(8)
	})
})

describe("adherence with wellness entries", () => {
	const plan: WeeklyPlan = [
		{ kind: "strength", session: "strength-a" },
		{ kind: "conditioning", title: "Cardio" },
		{ kind: "conditioning", title: "Combat" },
		{ kind: "conditioning", title: "Core" },
		{ kind: "strength", session: "strength-b" },
		{ kind: "conditioning", title: "Cardio" },
		{ kind: "rest" },
	]

	it("does not count a wellness log as attendance", () => {
		const result = adherence(
			[wellness("2026-08-18", { sleepHours: 8, steps: 9000 })],
			plan,
			TODAY,
		)
		expect(result.done).toBe(0)
	})
})

describe("wellnessEntrySchema", () => {
	it("accepts a single metric", () => {
		expect(
			wellnessEntrySchema.safeParse(wellness(TODAY, { sleepHours: 7.5 }))
				.success,
		).toBe(true)
		expect(
			wellnessEntrySchema.safeParse(wellness(TODAY, { steps: 12000 })).success,
		).toBe(true)
		expect(
			wellnessEntrySchema.safeParse(wellness(TODAY, { weightKg: 72.4 }))
				.success,
		).toBe(true)
	})

	it("refuses an entry carrying neither metric", () => {
		expect(wellnessEntrySchema.safeParse(wellness(TODAY, {})).success).toBe(
			false,
		)
	})

	it("bounds sleep to a day, steps to whole counts, and weight to a body", () => {
		const refuses = (metrics: {
			sleepHours?: number
			steps?: number
			weightKg?: number
		}) =>
			expect(
				wellnessEntrySchema.safeParse(wellness(TODAY, metrics)).success,
			).toBe(false)
		refuses({ sleepHours: 25 })
		refuses({ sleepHours: 0 })
		refuses({ steps: 0 })
		refuses({ steps: 7.5 })
		refuses({ weightKg: 0 })
		refuses({ weightKg: 7.24 })
		refuses({ weightKg: 725 })
	})
})
