import { describe, expect, it } from "vitest"
import { todaysSession } from "$src/engine"
import type {
	Catalogue,
	PlannedExercise,
	SessionTemplate,
	StrengthEntry,
} from "$src/schemas"

/**
 * `previous` feeds the today view's prefill, which re-logs the count under
 * `planned.unit` — a performance in another unit must never surface, or
 * "40 m" gets re-logged as "40 s".
 */

const TODAY = "2026-08-19"

const entry = (overrides: Partial<StrengthEntry>): StrengthEntry => ({
	kind: "strength",
	schemaVersion: 1,
	id: crypto.randomUUID(),
	date: "2026-08-17",
	session: "strength-b",
	ref: "farmer-walk",
	set: 1,
	kg: 24,
	reps: 40,
	rir: 2,
	unit: "m",
	...overrides,
})

const catalogue: Catalogue = {
	"farmer-walk": { name: "Farmer walk", main: false, direction: "ascending" },
}

const plannedSeconds: PlannedExercise = {
	ref: "farmer-walk",
	sets: 2,
	progression: "manual",
	unit: "s",
}

const template = (planned: PlannedExercise): SessionTemplate => ({
	id: "strength-b",
	name: "Strength B",
	exercises: [planned],
})

describe("todaysSession previous vs planned unit", () => {
	it("hides a previous performance logged in another unit (m plan edited to s)", () => {
		const log = [
			entry({ date: "2026-08-14", set: 1 }),
			entry({ date: "2026-08-14", set: 2 }),
		]
		const session = todaysSession(
			template(plannedSeconds),
			catalogue,
			log,
			TODAY,
		)
		expect(session.exercises[0].previous).toBeNull()
	})

	it("hides legacy rows that defaulted to reps when the plan counts seconds", () => {
		const log = [entry({ date: "2026-08-14", unit: "reps", reps: 45 })]
		const session = todaysSession(
			template(plannedSeconds),
			catalogue,
			log,
			TODAY,
		)
		expect(session.exercises[0].previous).toBeNull()
	})

	it("computes no auto target from history logged in another unit", () => {
		const plannedAuto: PlannedExercise = {
			ref: "farmer-walk",
			sets: 2,
			progression: "auto",
			unit: "reps",
			reps: { min: 8, max: 12 },
			increment: 4,
		}
		// Read as reps, two 40 m sets would clear the 12-rep top.
		const log = [
			entry({ date: "2026-08-14", set: 1 }),
			entry({ date: "2026-08-14", set: 2 }),
		]
		const session = todaysSession(template(plannedAuto), catalogue, log, TODAY)
		expect(session.exercises[0].target).toBeNull()
	})

	it("still surfaces the most recent performance in the planned unit", () => {
		const log = [
			entry({ date: "2026-08-10", unit: "s", reps: 30 }),
			entry({ date: "2026-08-14", unit: "m", reps: 40 }),
		]
		const session = todaysSession(
			template(plannedSeconds),
			catalogue,
			log,
			TODAY,
		)
		expect(session.exercises[0].previous).toEqual({
			date: "2026-08-10",
			sets: [{ kg: 24, reps: 30, rir: 2, unit: "s" }],
		})
	})
})
