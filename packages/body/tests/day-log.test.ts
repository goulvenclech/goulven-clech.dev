import { describe, expect, it } from "vitest"
import { formatSet, groupByDay, wellnessSummary } from "$src/dayLog"
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
	})

	it("reads a night that is not a whole hour on the clock", () => {
		expect(wellnessSummary(wellness({ sleepHours: 7.5 }))).toBe("7 h 30 sleep")
	})
})
