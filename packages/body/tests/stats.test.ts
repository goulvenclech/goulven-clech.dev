import { describe, expect, it } from "vitest"
import { adherence, oneRepMaxTrends, weeklyTonnage } from "$src/stats"
import type {
	Catalogue,
	ConditioningEntry,
	StrengthEntry,
	WeeklyPlan,
} from "$src/schemas"

const TODAY = "2026-08-19" // a Wednesday, ISO week 2026-W34

const CATALOGUE: Catalogue = {
	"back-squat": { name: "Back squat", main: true, direction: "ascending" },
	"barbell-row": { name: "Barbell row", main: false, direction: "ascending" },
	"farmer-walk": { name: "Farmer's walk", main: false, direction: "ascending" },
	"assisted-pull-up": {
		name: "Assisted pull-up",
		main: false,
		direction: "descending",
	},
}

const strength = (overrides: Partial<StrengthEntry>): StrengthEntry => ({
	kind: "strength",
	schemaVersion: 1,
	id: crypto.randomUUID(),
	date: TODAY,
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg: 80,
	reps: 5,
	rir: 2,
	unit: "reps",
	...overrides,
})

const conditioning = (
	overrides: Partial<ConditioningEntry>,
): ConditioningEntry => ({
	kind: "conditioning",
	schemaVersion: 1,
	id: crypto.randomUUID(),
	date: TODAY,
	category: "Cardio",
	workout: "cardio",
	level: 3,
	sets: 5,
	...overrides,
})

describe("oneRepMaxTrends", () => {
	it("keeps the best per-session estimate per week, per main lift", () => {
		const trends = oneRepMaxTrends(
			[
				strength({ set: 1 }), // closest to failure: 7 total reps
				strength({ set: 2, kg: 85, reps: 3, rir: 4 }),
				strength({ date: "2026-08-12", kg: 75 }), // previous week
			],
			CATALOGUE,
			TODAY,
			2,
		)

		expect(trends).toHaveLength(1)
		expect(trends[0].ref).toBe("back-squat")
		expect(trends[0].points.map((point) => point.week)).toEqual([
			"2026-W33",
			"2026-W34",
		])
		expect(trends[0].points[0].value).toBeCloseTo(75 * (1 + 7 / 30), 5)
		expect(trends[0].points[1].value).toBeCloseTo(80 * (1 + 7 / 30), 5)
	})

	it("skips non-reps sets even on a main ref", () => {
		// The log outlives templates: imported history can carry any unit.
		const trends = oneRepMaxTrends(
			[strength({ unit: "m", kg: 24, reps: 40 })],
			CATALOGUE,
			TODAY,
			2,
		)
		expect(trends).toHaveLength(0)
	})

	it("ignores accessory lifts and out-of-window sessions", () => {
		const trends = oneRepMaxTrends(
			[
				strength({ ref: "barbell-row" }),
				strength({ ref: "assisted-pull-up" }),
				strength({ date: "2025-01-01" }),
			],
			CATALOGUE,
			TODAY,
			2,
		)
		expect(trends).toHaveLength(0)
	})
})

describe("weeklyTonnage", () => {
	it("sums load × reps per week and zero-fills quiet weeks", () => {
		const points = weeklyTonnage(
			[
				strength({ set: 1, kg: 80, reps: 5 }),
				strength({ set: 2, kg: 60, reps: 10 }),
				// Counterweight, not load moved: excluded.
				strength({ ref: "assisted-pull-up", kg: 20, reps: 10 }),
				// kg × metres is not tonnage: excluded.
				strength({ ref: "farmer-walk", kg: 24, reps: 40, unit: "m" }),
				conditioning({}),
			],
			CATALOGUE,
			TODAY,
			2,
		)
		expect(points).toEqual([
			{ week: "2026-W33", value: 0 },
			{ week: "2026-W34", value: 1000 },
		])
	})
})

describe("adherence", () => {
	const plan: WeeklyPlan = [
		{ kind: "strength", session: "strength-a" },
		{ kind: "conditioning", title: "Cardio" },
		{ kind: "conditioning", title: "Combat" },
		{ kind: "conditioning", title: "Core" },
		{ kind: "strength", session: "strength-b" },
		{ kind: "conditioning", title: "Cardio" },
		{ kind: "rest" },
	]

	const pastEntries = [
		strength({ date: "2026-08-17", set: 1 }),
		strength({ date: "2026-08-17", set: 2 }), // same day counts once
		conditioning({ date: "2026-08-18" }),
		strength({ date: "2026-08-14" }),
		conditioning({ date: "2026-07-01" }), // outside the window
	]

	it("counts active days over scheduled days, today pending", () => {
		// 28 days ending 2026-08-19 contain four Sundays → 24 scheduled days,
		// minus today, still unlogged → 23.
		expect(adherence(pastEntries, plan, TODAY)).toEqual({
			done: 3,
			planned: 23,
			ratio: 3 / 23,
		})
	})

	it("counts a skipped session as a miss, not as a day done", () => {
		const skipped = {
			kind: "skipped" as const,
			schemaVersion: 1 as const,
			id: crypto.randomUUID(),
			date: "2026-08-11",
			planned: "Cardio",
			reason: "ill",
		}
		expect(adherence([...pastEntries, skipped], plan, TODAY)).toEqual({
			done: 3,
			planned: 23,
			ratio: 3 / 23,
		})
	})

	it("counts today as planned once it is declared skipped", () => {
		const skippedToday = {
			kind: "skipped" as const,
			schemaVersion: 1 as const,
			id: crypto.randomUUID(),
			date: TODAY,
			planned: "Combat",
			reason: "ill",
		}
		expect(adherence([...pastEntries, skippedToday], plan, TODAY)).toEqual({
			done: 3,
			planned: 24,
			ratio: 3 / 24,
		})
	})

	it("counts today as planned once something is logged", () => {
		const result = adherence(
			[...pastEntries, conditioning({ date: TODAY })],
			plan,
			TODAY,
		)
		expect(result).toEqual({ done: 4, planned: 24, ratio: 4 / 24 })
	})

	it("counts a bonus rest-day session toward done only", () => {
		// 2026-08-16 is a Sunday.
		const result = adherence(
			[...pastEntries, conditioning({ date: "2026-08-16" })],
			plan,
			TODAY,
		)
		expect(result).toEqual({ done: 4, planned: 23, ratio: 4 / 23 })
	})
})

describe("a slug deleted from the catalogue", () => {
	const log = [
		strength({ set: 1 }),
		strength({ ref: "retired-lift", kg: 40, set: 1 }),
	]
	const full: Catalogue = {
		...CATALOGUE,
		"retired-lift": { name: "Retired", main: true, direction: "ascending" },
	}

	it("silently removes its past tonnage", () => {
		const week = (points: { week: string; value: number | null }[]) =>
			points.find((point) => point.week === "2026-W34")?.value
		expect(week(weeklyTonnage(log, full, TODAY))).toBe(80 * 5 + 40 * 5)
		expect(week(weeklyTonnage(log, CATALOGUE, TODAY))).toBe(80 * 5)
	})

	it("drops its 1RM trend", () => {
		expect(
			oneRepMaxTrends(log, full, TODAY)
				.map((t) => t.ref)
				.sort(),
		).toEqual(["back-squat", "retired-lift"])
		expect(oneRepMaxTrends(log, CATALOGUE, TODAY).map((t) => t.ref)).toEqual([
			"back-squat",
		])
	})
})
