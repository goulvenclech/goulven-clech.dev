import { describe, expect, it } from "vitest"
import {
	estimateOneRepMax,
	exercisePerformances,
	nextTarget,
	todaysSession,
	type Performance,
} from "$src/engine"
import type {
	AutoPlannedExercise,
	Catalogue,
	Exercise,
	LogEntry,
	PlannedExercise,
	SessionTemplate,
	StrengthEntry,
} from "$src/schemas"

const TODAY = "2026-08-19"

const SQUAT: Exercise = {
	name: "Back squat",
	main: true,
	direction: "ascending",
}
const PULL_UP: Exercise = {
	name: "Assisted pull-up",
	main: false,
	direction: "descending",
}

const PLANNED: AutoPlannedExercise = {
	ref: "back-squat",
	sets: 3,
	reps: { min: 5, max: 8 },
	increment: 2.5,
	progression: "auto",
	unit: "reps",
}

const perf = (
	date: string,
	kg: number,
	reps: number[],
	rir = 2,
): Performance => ({
	date,
	sets: reps.map((r) => ({ kg, reps: r, rir, unit: "reps" })),
})

const entry = (overrides: Partial<StrengthEntry>): StrengthEntry => ({
	kind: "strength",
	schemaVersion: 1,
	id: crypto.randomUUID(),
	date: "2026-08-17",
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg: 60,
	reps: 5,
	rir: 2,
	unit: "reps",
	...overrides,
})

describe("nextTarget", () => {
	it("returns null without history, so the UI asks for a starting load", () => {
		expect(nextTarget(PLANNED, SQUAT, [], TODAY)).toBeNull()
	})

	it("holds the load and adds a rep to the weakest set", () => {
		const history = [perf("2026-08-17", 60, [6, 5, 5])]
		expect(nextTarget(PLANNED, SQUAT, history, TODAY)).toEqual({
			kg: 60,
			reps: 6,
			basis: "hold",
		})
	})

	it("caps the rep target at the range's top", () => {
		const history = [perf("2026-08-17", 60, [8, 8, 7])]
		expect(nextTarget(PLANNED, SQUAT, history, TODAY)).toMatchObject({
			reps: 8,
			basis: "hold",
		})
	})

	it("loads up and resets reps once every set hits the top", () => {
		const history = [perf("2026-08-17", 60, [8, 8, 8])]
		expect(nextTarget(PLANNED, SQUAT, history, TODAY)).toEqual({
			kg: 62.5,
			reps: 5,
			basis: "progress",
		})
	})

	it("does not progress on a session with missing sets", () => {
		const history = [perf("2026-08-17", 60, [8, 8])]
		expect(nextTarget(PLANNED, SQUAT, history, TODAY)).toMatchObject({
			kg: 60,
			basis: "hold",
		})
	})

	it("progresses a descending exercise by removing counterweight", () => {
		const planned = { ...PLANNED, ref: "assisted-pull-up" }
		const history = [perf("2026-08-17", 20, [8, 8, 8])]
		expect(nextTarget(planned, PULL_UP, history, TODAY)).toEqual({
			kg: 17.5,
			reps: 5,
			basis: "progress",
		})
	})

	it("floors a descending progression at zero counterweight", () => {
		const planned = { ...PLANNED, ref: "assisted-pull-up" }
		const history = [perf("2026-08-17", 1.25, [8, 8, 8])]
		expect(nextTarget(planned, PULL_UP, history, TODAY)).toMatchObject({
			kg: 0,
		})
	})

	it("deloads 10% after three strictly identical sessions", () => {
		const history = [
			perf("2026-08-10", 60, [5, 5, 5]),
			perf("2026-08-12", 60, [5, 5, 5]),
			perf("2026-08-17", 60, [5, 5, 5]),
		]
		// 60 × 0.9 = 54, rounded to the 2.5 increment → 55.
		expect(nextTarget(PLANNED, SQUAT, history, TODAY)).toEqual({
			kg: 55,
			reps: 5,
			basis: "stall-deload",
		})
	})

	it("ignores RIR when judging a stall", () => {
		const history = [
			perf("2026-08-10", 60, [5, 5, 5], 3),
			perf("2026-08-12", 60, [5, 5, 5], 1),
			perf("2026-08-17", 60, [5, 5, 5], 0),
		]
		expect(nextTarget(PLANNED, SQUAT, history, TODAY)).toMatchObject({
			basis: "stall-deload",
		})
	})

	it("does not deload while any of the last three sessions differs", () => {
		const history = [
			perf("2026-08-10", 60, [5, 5, 4]),
			perf("2026-08-12", 60, [5, 5, 5]),
			perf("2026-08-17", 60, [5, 5, 5]),
		]
		expect(nextTarget(PLANNED, SQUAT, history, TODAY)).toMatchObject({
			basis: "hold",
		})
	})

	it("deloads 12% after more than 14 days off the exercise", () => {
		const history = [perf("2026-08-01", 60, [8, 8, 8])] // 18 days before
		// 60 × 0.88 = 52.8, rounded to the 2.5 increment → 52.5.
		expect(nextTarget(PLANNED, SQUAT, history, TODAY)).toEqual({
			kg: 52.5,
			reps: 5,
			basis: "layoff-deload",
		})
	})

	it("treats exactly 14 days off as a normal session", () => {
		const history = [perf("2026-08-05", 60, [8, 8, 8])]
		expect(nextTarget(PLANNED, SQUAT, history, TODAY)).toMatchObject({
			basis: "progress",
		})
	})

	it("lets a layoff outrank a stall", () => {
		const history = [
			perf("2026-07-20", 60, [5, 5, 5]),
			perf("2026-07-22", 60, [5, 5, 5]),
			perf("2026-07-24", 60, [5, 5, 5]),
		]
		expect(nextTarget(PLANNED, SQUAT, history, TODAY)).toMatchObject({
			basis: "layoff-deload",
		})
	})

	it("deloads a descending exercise by adding counterweight", () => {
		const planned = { ...PLANNED, ref: "assisted-pull-up" }
		const history = [
			perf("2026-08-10", 20, [5, 5, 5]),
			perf("2026-08-12", 20, [5, 5, 5]),
			perf("2026-08-17", 20, [5, 5, 5]),
		]
		// 20 × 1.1 = 22, rounded to the 2.5 increment → 22.5.
		expect(nextTarget(planned, PULL_UP, history, TODAY)).toEqual({
			kg: 22.5,
			reps: 5,
			basis: "stall-deload",
		})
	})

	it("works from the lightest counterweight when descending loads disagree", () => {
		const planned = { ...PLANNED, ref: "assisted-pull-up" }
		const history: Performance[] = [
			{
				date: "2026-08-17",
				sets: [
					{ kg: 20, reps: 5, rir: 2, unit: "reps" },
					{ kg: 17.5, reps: 5, rir: 2, unit: "reps" },
				],
			},
		]
		expect(nextTarget(planned, PULL_UP, history, TODAY)).toMatchObject({
			kg: 17.5,
		})
	})

	it("works from the heaviest set when logged loads disagree", () => {
		const history: Performance[] = [
			{
				date: "2026-08-17",
				sets: [
					{ kg: 60, reps: 5, rir: 2, unit: "reps" },
					{ kg: 62.5, reps: 5, rir: 2, unit: "reps" },
				],
			},
		]
		expect(nextTarget(PLANNED, SQUAT, history, TODAY)).toMatchObject({
			kg: 62.5,
		})
	})
})

describe("exercisePerformances", () => {
	it("groups strength entries by day, in date and set order", () => {
		const log: LogEntry[] = [
			entry({ date: "2026-08-17", set: 2, reps: 6 }),
			entry({ date: "2026-08-17", set: 1, reps: 7 }),
			entry({ date: "2026-08-10", set: 1, kg: 57.5 }),
			entry({ ref: "bench-press", kg: 40 }),
			{
				kind: "conditioning",
				schemaVersion: 1,
				id: crypto.randomUUID(),
				date: "2026-08-17",
				category: "Cardio",
				workout: "cardio",
				level: 3,
				sets: 5,
			},
		]
		expect(exercisePerformances(log, "back-squat")).toEqual([
			{
				date: "2026-08-10",
				sets: [{ kg: 57.5, reps: 5, rir: 2, unit: "reps" }],
			},
			{
				date: "2026-08-17",
				sets: [
					{ kg: 60, reps: 7, rir: 2, unit: "reps" },
					{ kg: 60, reps: 6, rir: 2, unit: "reps" },
				],
			},
		])
	})
})

describe("todaysSession", () => {
	const catalogue: Catalogue = { "back-squat": SQUAT }
	const template: SessionTemplate = {
		id: "strength-a",
		name: "Strength A",
		exercises: [PLANNED],
	}

	it("derives targets from days strictly before today", () => {
		const log = [
			entry({ date: "2026-08-17", set: 1, reps: 8 }),
			entry({ date: "2026-08-17", set: 2, reps: 8 }),
			entry({ date: "2026-08-17", set: 3, reps: 8 }),
			entry({ date: TODAY, kg: 62.5, reps: 5 }),
		]
		const session = todaysSession(template, catalogue, log, TODAY)
		expect(session.exercises[0].target).toMatchObject({
			kg: 62.5,
			basis: "progress",
		})
		expect(session.exercises[0].loggedToday).toEqual([
			{ kg: 62.5, reps: 5, rir: 2, unit: "reps" },
		])
	})

	it("throws on a ref missing from the catalogue", () => {
		expect(() => todaysSession(template, {}, [], TODAY)).toThrow(/back-squat/)
	})

	it("computes no target for manual entries, only the previous performance", () => {
		const plank: PlannedExercise = {
			ref: "plank",
			sets: 2,
			progression: "manual",
			unit: "s",
		}
		const manualTemplate: SessionTemplate = {
			...template,
			exercises: [plank],
		}
		const withPlank: Catalogue = {
			...catalogue,
			plank: { name: "Plank", main: false, direction: "ascending" },
		}
		const log = [
			entry({ ref: "plank", date: "2026-06-01", kg: 0, reps: 45, unit: "s" }),
			entry({ ref: "plank", date: "2026-08-17", kg: 0, reps: 60, unit: "s" }),
		]
		const session = todaysSession(manualTemplate, withPlank, log, TODAY)
		// Notably no layoff deload despite the June gap.
		expect(session.exercises[0].target).toBeNull()
		expect(session.exercises[0].previous).toEqual({
			date: "2026-08-17",
			sets: [{ kg: 0, reps: 60, rir: 2, unit: "s" }],
		})
	})

	it("keeps other exercises' plans untouched by today's entries", () => {
		const bench: Exercise = {
			name: "Bench press",
			main: true,
			direction: "ascending",
		}
		const twoLifts = {
			...template,
			exercises: [PLANNED, { ...PLANNED, ref: "bench-press" }],
		}
		const history = [1, 2, 3].flatMap((set) => [
			entry({ set, reps: 8 }),
			entry({ ref: "bench-press", kg: 40, set, reps: 8 }),
		])
		const before = todaysSession(
			twoLifts,
			{ ...catalogue, "bench-press": bench },
			history,
			TODAY,
		)
		const after = todaysSession(
			twoLifts,
			{ ...catalogue, "bench-press": bench },
			[...history, entry({ date: TODAY, kg: 62.5 })],
			TODAY,
		)
		expect(after.exercises.find((e) => e.ref === "bench-press")).toEqual(
			before.exercises.find((e) => e.ref === "bench-press"),
		)
	})
})

describe("estimateOneRepMax", () => {
	it("uses the set closest to failure, counting reps left in reserve", () => {
		const estimate = estimateOneRepMax([
			{ kg: 80, reps: 5, rir: 3, unit: "reps" },
			{ kg: 80, reps: 5, rir: 1, unit: "reps" }, // closest to failure: 6 total reps
		])
		expect(estimate).toBeCloseTo(80 * (1 + 6 / 30), 5)
	})

	it("breaks RIR ties towards the higher estimate", () => {
		const estimate = estimateOneRepMax([
			{ kg: 80, reps: 5, rir: 2, unit: "reps" },
			{ kg: 85, reps: 5, rir: 2, unit: "reps" },
		])
		expect(estimate).toBeCloseTo(85 * (1 + 7 / 30), 5)
	})

	it("takes a single all-out rep as already maximal", () => {
		expect(
			estimateOneRepMax([{ kg: 100, reps: 1, rir: 0, unit: "reps" }]),
		).toBe(100)
	})

	it("ignores sets counted in metres or seconds", () => {
		// The all-out timed hold must not win the closest-to-failure pick.
		const estimate = estimateOneRepMax([
			{ kg: 100, reps: 5, rir: 2, unit: "reps" },
			{ kg: 20, reps: 60, rir: 0, unit: "s" },
		])
		expect(estimate).toBeCloseTo(100 * (1 + 7 / 30), 5)
		expect(
			estimateOneRepMax([{ kg: 24, reps: 40, rir: 1, unit: "m" }]),
		).toBeNull()
	})

	it("returns null without sets", () => {
		expect(estimateOneRepMax([])).toBeNull()
	})
})
