import { describe, expect, it } from "vitest"
import {
	APP_GUIDANCE,
	type GuidanceLabels,
	PLAIN_GUIDANCE,
	formatSet,
	groupByDay,
	guidanceFor,
	wellnessSummary,
} from "$src/dayLog"
import type { ExercisePlan } from "$src/engine"
import { LOG_SCHEMA_VERSION, type LogEntry } from "$src/schemas"

const strength = (
	date: string,
	set: number,
	overrides: Partial<Extract<LogEntry, { kind: "strength" }>> = {},
): LogEntry => ({
	kind: "strength",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: crypto.randomUUID(),
	date,
	session: "strength-a",
	ref: "back-squat",
	set,
	kg: 60,
	reps: 5,
	unit: "reps",
	...overrides,
})

const conditioning = (date: string, category: string): LogEntry => ({
	kind: "conditioning",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: crypto.randomUUID(),
	date,
	category,
	workout: "cardio go",
	level: 3,
	sets: 5,
})

describe("formatSet", () => {
	it("drops the load for bodyweight timed or distance sets", () => {
		expect(formatSet({ kg: 0, reps: 30, unit: "s" })).toBe("30 s")
		expect(formatSet({ kg: 0, reps: 40, unit: "m" })).toBe("40 m")
	})

	it("keeps the load when a timed set is weighted", () => {
		expect(formatSet({ kg: 20, reps: 30, unit: "s" })).toBe("20 kg × 30 s")
	})

	it("reads a hold past a minute on the clock", () => {
		expect(formatSet({ kg: 0, reps: 90, unit: "s" })).toBe("1 min 30")
		expect(formatSet({ kg: 20, reps: 120, unit: "s" })).toBe("20 kg × 2 min")
	})
})

describe("groupByDay", () => {
	it("lists days newest first, whatever the log order", () => {
		const days = groupByDay([
			strength("2026-08-10", 1),
			strength("2026-08-17", 1),
			strength("2026-08-14", 1),
		])
		expect(days.map((day) => day.date)).toEqual([
			"2026-08-17",
			"2026-08-14",
			"2026-08-10",
		])
	})

	it("orders a day's sets and groups them by exercise", () => {
		const [day] = groupByDay([
			strength("2026-08-17", 2),
			strength("2026-08-17", 1),
		])
		expect(day.strength).toEqual([
			{
				ref: "back-squat",
				sets: [
					expect.objectContaining({ set: 1 }),
					expect.objectContaining({ set: 2 }),
				],
			},
		])
	})

	it("labels a day with Strength then conditioning categories, deduplicated", () => {
		const [day] = groupByDay([
			conditioning("2026-08-18", "Cardio"),
			conditioning("2026-08-18", "Cardio"),
			strength("2026-08-18", 1),
		])
		expect(day.labels).toEqual(["Strength", "Cardio"])
	})
})

describe("rest days", () => {
	const wellnessOn = (date: string): LogEntry => ({
		kind: "wellness",
		schemaVersion: LOG_SCHEMA_VERSION,
		id: crypto.randomUUID(),
		date,
		sleepHours: 8,
	})

	it("type the card the wellness alone would have left blank", () => {
		// Sunday, one of the plan's days off.
		const [day] = groupByDay([wellnessOn("2026-08-23")])
		expect(day.labels).toEqual(["Rest"])
	})

	it("say nothing about a scheduled day that only carries wellness", () => {
		const [day] = groupByDay([wellnessOn("2026-08-17")])
		expect(day.labels).toEqual([])
	})
})

describe("automatic skips", () => {
	const marked = (date: string, reason?: string): LogEntry => ({
		kind: "skipped",
		schemaVersion: LOG_SCHEMA_VERSION,
		id: crypto.randomUUID(),
		date,
		planned: "Strength",
		...(reason === undefined ? {} : { reason }),
	})

	it("make way for a session that only synced in later", () => {
		const [day] = groupByDay([marked("2026-08-17"), strength("2026-08-17", 1)])
		expect(day.skipped).toEqual([])
		expect(day.labels).toEqual(["Strength"])
	})

	it("stand on a day nothing else was logged", () => {
		const [day] = groupByDay([marked("2026-08-17")])
		expect(day.labels).toEqual(["Skipped"])
	})

	it("give way to a reason that synced in from another device", () => {
		const [day] = groupByDay([
			marked("2026-08-17"),
			marked("2026-08-17", "ill"),
		])
		expect(day.skipped).toEqual([expect.objectContaining({ reason: "ill" })])
	})

	it("never overrule a reason the user gave", () => {
		const [day] = groupByDay([
			marked("2026-08-17", "ill"),
			strength("2026-08-17", 1),
		])
		expect(day.skipped).toHaveLength(1)
		expect(day.labels).toEqual(["Skipped", "Strength"])
	})
})

describe("wellnessSummary", () => {
	const wellness = (
		fields: Partial<Extract<LogEntry, { kind: "wellness" }>>,
	): Extract<LogEntry, { kind: "wellness" }> => ({
		kind: "wellness",
		schemaVersion: LOG_SCHEMA_VERSION,
		id: crypto.randomUUID(),
		date: "2026-08-17",
		...fields,
	})

	it("renders whichever metrics are present", () => {
		expect(wellnessSummary(wellness({ sleepHours: 9, steps: 4200 }))).toBe(
			"9 h sleep · 4200 steps",
		)
		expect(wellnessSummary(wellness({ sleepHours: 9 }))).toBe("9 h sleep")
		expect(wellnessSummary(wellness({ steps: 4200 }))).toBe("4200 steps")
		expect(wellnessSummary(wellness({ weightKg: 72.4 }))).toBe(
			"72.4 kg body weight",
		)
		expect(
			wellnessSummary(wellness({ sleepHours: 9, steps: 4200, weightKg: 72.4 })),
		).toBe("9 h sleep · 4200 steps · 72.4 kg body weight")
	})

	it("reads a night that is not a whole hour on the clock", () => {
		expect(wellnessSummary(wellness({ sleepHours: 7.5 }))).toBe("7 h 30 sleep")
	})
})

describe("guidanceFor", () => {
	const plan = (overrides: Partial<ExercisePlan> = {}): ExercisePlan => ({
		ref: "back-squat",
		exercise: { name: "Back squat", main: true, direction: "ascending" },
		planned: {
			ref: "back-squat",
			sets: 3,
			progression: "auto",
			unit: "reps",
			reps: { min: 5, max: 8 },
			increment: 2.5,
		},
		target: { kg: 60, reps: 8, basis: "hold" },
		previous: null,
		loggedToday: [],
		...overrides,
	})

	const both = (overrides: Partial<ExercisePlan> = {}) => [
		guidanceFor(plan(overrides), APP_GUIDANCE),
		guidanceFor(plan(overrides), PLAIN_GUIDANCE),
	]

	it("speaks to the lifter on screen and spells it out for the twin", () => {
		expect(both()).toEqual(["One more rep 💪", "Same load, one more rep"])
	})

	it("keeps the twin's voice clear of the screen's emoji", () => {
		const emoji = /\p{Extended_Pictographic}/u
		for (const line of Object.values(PLAIN_GUIDANCE.basis))
			expect(line).not.toMatch(emoji)
		expect(PLAIN_GUIDANCE.firstTime).not.toMatch(emoji)
	})

	it("reads every basis off the table it was handed", () => {
		const voice: GuidanceLabels = {
			basis: {
				progress: "up",
				hold: "same",
				"stall-deload": "stalled",
				"layoff-deload": "off",
			},
			firstTime: "new",
		}
		const bases = ["progress", "hold", "stall-deload", "layoff-deload"] as const
		expect(
			bases.map((basis) =>
				guidanceFor(plan({ target: { kg: 60, reps: 5, basis } }), voice),
			),
		).toEqual(["up", "same", "stalled", "off"])
	})

	it("greets an exercise with no history the same way, auto or manual", () => {
		const auto = both({ target: null })
		const manual = both({
			target: null,
			planned: { ...plan().planned, progression: "manual" },
		})
		expect(auto).toEqual(["First time ✨", "First time, no history yet"])
		expect(manual).toEqual(auto)
	})

	it("points a manual exercise at the session its fields came from", () => {
		expect(
			both({
				target: null,
				planned: { ...plan().planned, progression: "manual" },
				previous: {
					date: "2026-08-10",
					sets: [{ kg: 60, reps: 5, unit: "reps" }],
				},
			}),
		).toEqual(["Prefilled from Mon 10 Aug", "Prefilled from Mon 10 Aug"])
	})
})
