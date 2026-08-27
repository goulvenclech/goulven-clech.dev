import { describe, expect, it } from "vitest"
import {
	EXERCISES,
	SESSIONS,
	WEEKLY_PLAN,
	crossCheckProgram,
	exerciseByRef,
	planFor,
} from "$src/program"
import {
	catalogueSchema,
	exerciseSchema,
	plannedExerciseSchema,
	sessionFileSchema,
	weeklyPlanSchema,
} from "$src/schemas"

/**
 * The data files are parsed when program.ts loads: merely importing it
 * already fails the suite on an invalid file.
 */

describe("data files", () => {
	it("resolves every session exercise ref in the catalogue", () => {
		for (const session of Object.values(SESSIONS))
			for (const { ref } of session.exercises)
				expect(EXERCISES[ref], `${session.id} → ${ref}`).toBeDefined()
	})

	it("resolves every planned strength day to a session", () => {
		for (const day of WEEKLY_PLAN)
			if (day.kind === "strength")
				expect(SESSIONS[day.session], day.session).toBeDefined()
	})

	it("plans a full seven-day week", () => {
		expect(WEEKLY_PLAN).toHaveLength(7)
	})
})

describe("planFor", () => {
	it("maps a date to its weekday's plan", () => {
		expect(planFor("2026-08-17")).toEqual(WEEKLY_PLAN[0]) // Monday
		expect(planFor("2026-08-23")).toEqual(WEEKLY_PLAN[6]) // Sunday
	})

	it("takes Thursday and Sunday off", () => {
		expect(planFor("2026-08-20").kind).toBe("rest")
		expect(planFor("2026-08-23").kind).toBe("rest")
	})
})

describe("exerciseByRef", () => {
	it("resolves a known slug and returns null otherwise", () => {
		expect(exerciseByRef("back-squat")).toMatchObject({ main: true })
		expect(exerciseByRef("curl")).toBeNull()
	})
})

describe("schemas", () => {
	const validExercise = {
		name: "Back squat",
		main: true,
		direction: "ascending",
	}

	it("rejects a misspelt field instead of ignoring it", () => {
		expect(
			exerciseSchema.safeParse({ ...validExercise, mian: true }).success,
		).toBe(false)
	})

	it("rejects a non-kebab-case slug", () => {
		expect(
			catalogueSchema.safeParse({ "Back Squat": validExercise }).success,
		).toBe(false)
	})

	it("rejects a descending main exercise: Epley on a counterweight", () => {
		expect(
			exerciseSchema.safeParse({
				...validExercise,
				main: true,
				direction: "descending",
			}).success,
		).toBe(false)
	})

	it("rejects an inverted rep range", () => {
		expect(
			sessionFileSchema.safeParse({
				name: "Strength A",
				exercises: [
					{
						ref: "back-squat",
						sets: 3,
						reps: { min: 8, max: 5 },
						increment: 2.5,
					},
				],
			}).success,
		).toBe(false)
	})

	it("rejects a week that is not exactly seven days", () => {
		expect(weeklyPlanSchema.safeParse([{ kind: "rest" }]).success).toBe(false)
	})

	it("defaults planned entries to auto progression counting reps", () => {
		const parsed = plannedExerciseSchema.parse({
			ref: "back-squat",
			sets: 3,
			reps: { min: 5, max: 8 },
			increment: 2.5,
		})
		expect(parsed.progression).toBe("auto")
		expect(parsed.unit).toBe("reps")
	})

	it("rejects auto entries missing a reps range or increment", () => {
		expect(
			plannedExerciseSchema.safeParse({ ref: "back-squat", sets: 3 }).success,
		).toBe(false)
	})

	it("rejects auto entries counted in seconds or metres", () => {
		expect(
			plannedExerciseSchema.safeParse({
				ref: "plank",
				sets: 2,
				reps: { min: 5, max: 8 },
				increment: 2.5,
				unit: "s",
			}).success,
		).toBe(false)
	})

	it("rejects manual entries carrying a dead increment", () => {
		expect(
			plannedExerciseSchema.safeParse({
				ref: "plank",
				sets: 2,
				progression: "manual",
				unit: "s",
				increment: 2.5,
			}).success,
		).toBe(false)
	})
})

describe("crossCheckProgram", () => {
	it("rejects a main lift on manual progression", () => {
		const catalogue = {
			"back-squat": {
				name: "Back squat",
				main: true,
				direction: "ascending" as const,
			},
		}
		const sessions = {
			"strength-a": {
				id: "strength-a",
				name: "Strength A",
				exercises: [
					{
						ref: "back-squat",
						sets: 3,
						progression: "manual" as const,
						unit: "reps" as const,
					},
				],
			},
		}
		expect(() => crossCheckProgram(catalogue, sessions, WEEKLY_PLAN)).toThrow(
			/must progress automatically/,
		)
	})

	it("rejects a ref counted in different units across sessions", () => {
		const catalogue = {
			"farmer-walk": {
				name: "Farmer's walk",
				main: false,
				direction: "ascending" as const,
			},
		}
		const entryIn = (unit: "m" | "s") => ({
			ref: "farmer-walk",
			sets: 2,
			progression: "manual" as const,
			unit,
		})
		const sessions = {
			"strength-a": { id: "strength-a", name: "A", exercises: [entryIn("m")] },
			"strength-b": { id: "strength-b", name: "B", exercises: [entryIn("s")] },
		}
		expect(() => crossCheckProgram(catalogue, sessions, WEEKLY_PLAN)).toThrow(
			/counted in/,
		)
	})
})
