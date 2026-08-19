import { describe, expect, it } from "vitest"
import {
	adherence,
	epleyOneRepMax,
	oneRepMaxTrends,
	setsByPattern,
	weeklyTonnage,
	type LoggedSet,
} from "$src/stats"

const TODAY = "2026-08-19" // a Wednesday, ISO week 2026-W34

const set = (overrides: Partial<LoggedSet>): LoggedSet => ({
	date: TODAY,
	exercise: "squat",
	pattern: "squat",
	weight_kg: 80,
	reps: 5,
	...overrides,
})

describe("epleyOneRepMax", () => {
	it("estimates weight × (1 + reps / 30)", () => {
		expect(epleyOneRepMax(100, 10)).toBeCloseTo(133.33, 2)
	})

	it("takes a single rep as already maximal", () => {
		expect(epleyOneRepMax(100, 1)).toBe(100)
	})

	it("returns null for bodyweight sets or nonsense reps", () => {
		expect(epleyOneRepMax(null, 5)).toBeNull()
		expect(epleyOneRepMax(100, 0)).toBeNull()
	})
})

describe("oneRepMaxTrends", () => {
	it("keeps the best estimate per week, per main lift", () => {
		const trends = oneRepMaxTrends(
			[
				set({ weight_kg: 80, reps: 5 }), // Epley ≈ 93.3
				set({ weight_kg: 90, reps: 1 }), // 90, beaten by the set above
				set({ date: "2026-08-12", weight_kg: 75, reps: 5 }), // previous week
			],
			TODAY,
			2,
		)

		expect(trends).toHaveLength(1)
		expect(trends[0].exercise.slug).toBe("squat")
		expect(trends[0].points.map((point) => point.week)).toEqual([
			"2026-W33",
			"2026-W34",
		])
		expect(trends[0].points[0].value).toBeCloseTo(87.5, 1)
		expect(trends[0].points[1].value).toBeCloseTo(93.33, 2)
	})

	it("ignores accessory lifts, bodyweight sets and out-of-window sets", () => {
		const trends = oneRepMaxTrends(
			[
				set({
					exercise: "push-up",
					pattern: "push",
					weight_kg: null,
					reps: 20,
				}),
				set({ weight_kg: null }),
				set({ date: "2025-01-01" }),
			],
			TODAY,
			2,
		)
		expect(trends).toHaveLength(0)
	})
})

describe("weeklyTonnage", () => {
	it("sums weight × reps per week and zero-fills quiet weeks", () => {
		const points = weeklyTonnage(
			[
				set({ weight_kg: 80, reps: 5 }),
				set({ weight_kg: 60, reps: 10 }),
				set({ weight_kg: null, reps: 20 }), // bodyweight counts zero
			],
			TODAY,
			2,
		)
		expect(points).toEqual([
			{ week: "2026-W33", value: 0 },
			{ week: "2026-W34", value: 1000 },
		])
	})
})

describe("setsByPattern", () => {
	it("counts sets inside the window only, zeroes included", () => {
		const counts = setsByPattern(
			[
				set({}),
				set({ exercise: "bench-press", pattern: "push" }),
				set({ date: "2026-08-01" }), // outside the 7-day window
			],
			TODAY,
		)
		expect(counts.find((entry) => entry.pattern === "squat")?.count).toBe(1)
		expect(counts.find((entry) => entry.pattern === "push")?.count).toBe(1)
		expect(counts.find((entry) => entry.pattern === "hinge")?.count).toBe(0)
		expect(counts).toHaveLength(6)
	})
})

describe("adherence", () => {
	const pastSessions: Parameters<typeof adherence>[0] = [
		{ date: "2026-08-17", status: "completed" },
		{ date: "2026-08-18", status: "partial" },
		{ date: "2026-08-14", status: "completed" },
		{ date: "2026-08-13", status: "skipped" }, // skipped doesn't count
		{ date: "2026-07-01", status: "completed" }, // outside the window
	]

	it("counts done sessions over scheduled days, today pending", () => {
		// 28 days ending 2026-08-19 contain four Sundays → 24 scheduled days,
		// minus today, still unlogged → 23.
		expect(adherence(pastSessions, TODAY)).toEqual({
			done: 3,
			planned: 23,
			ratio: 3 / 23,
		})
	})

	it("counts today as planned once its session is logged", () => {
		const result = adherence(
			[...pastSessions, { date: TODAY, status: "completed" }],
			TODAY,
		)
		expect(result).toEqual({ done: 4, planned: 24, ratio: 4 / 24 })
	})
})
