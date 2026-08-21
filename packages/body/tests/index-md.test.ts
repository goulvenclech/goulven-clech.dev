import { describe, expect, it } from "vitest"
import type { ExercisePlan } from "$src/engine"
import {
	buildIndexView,
	renderBodyIndex,
	renderTodaySection,
	type IndexView,
} from "$src/pages/index.md"
import { LOG_SCHEMA_VERSION, type LogEntry } from "$src/schemas"

const SITE = "https://example.com"

const squat: ExercisePlan = {
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
}

function view(overrides: Partial<IndexView>): IndexView {
	return {
		site: SITE,
		date: "2026-08-17",
		day: { kind: "rest" },
		session: null,
		conditioningLogged: null,
		...overrides,
	}
}

describe("renderTodaySection", () => {
	it("renders a strength day with target, plan, and guidance per exercise", () => {
		const strength = view({
			day: { kind: "strength", session: "strength-a" },
			session: { id: "strength-a", exercises: [squat] },
		})
		expect(renderTodaySection(strength).split("\n")).toEqual([
			"## Today — 2026-08-17 (Monday)",
			"",
			"Strength at the gym — session strength-a.",
			"",
			"- Back squat: target 60 kg × 8 · 3 sets of 5–8 · Same load — one more rep",
		])
	})

	it("marks a first-time exercise and appends logged sets", () => {
		const logged = view({
			day: { kind: "strength", session: "strength-a" },
			session: {
				id: "strength-a",
				exercises: [
					{
						...squat,
						target: null,
						loggedToday: [{ kg: 60, reps: 8, unit: "reps" }],
					},
				],
			},
		})
		expect(renderTodaySection(logged)).toContain(
			"- Back squat: target — · 3 sets of 5–8 · First time — pick a starting load · done: 60 kg × 8",
		)
	})

	it("renders a rest day", () => {
		expect(renderTodaySection(view({}))).toBe(
			"## Today — 2026-08-17 (Monday)\n\nRest day — nothing to log.",
		)
	})

	it("renders a conditioning day, with its logged workout when present", () => {
		const conditioning = view({
			day: { kind: "conditioning", title: "Cardio" },
			conditioningLogged: {
				kind: "conditioning",
				schemaVersion: LOG_SCHEMA_VERSION,
				id: "22222222-2222-4222-8222-222222222222",
				date: "2026-08-17",
				category: "Cardio",
				workout: "cardio go",
				level: 3,
				sets: 5,
			},
		})
		expect(renderTodaySection(conditioning).split("\n")).toEqual([
			"## Today — 2026-08-17 (Monday)",
			"",
			"Conditioning at home: Cardio.",
			"Done: cardio go · level 3 · 5 sets.",
		])
	})
})

describe("renderBodyIndex", () => {
	it("links the other twins as absolute URLs", () => {
		const document = renderBodyIndex(view({}))
		expect(document).toContain(`${SITE}/log.md`)
		expect(document).toContain(`${SITE}/stats.md`)
		expect(document).toContain(`${SITE}/llms.txt`)
	})
})

describe("buildIndexView", () => {
	const priorSquat: LogEntry = {
		kind: "strength",
		schemaVersion: LOG_SCHEMA_VERSION,
		id: "11111111-1111-4111-8111-111111111111",
		date: "2026-08-10",
		session: "strength-a",
		ref: "back-squat",
		set: 1,
		kg: 60,
		reps: 8,
		unit: "reps",
	}

	it("computes the strength session's targets from prior history", () => {
		const built = buildIndexView(
			SITE,
			"2026-08-17",
			{ kind: "strength", session: "strength-a" },
			[priorSquat],
		)
		const plan = built.session!.exercises.find(
			(exercise) => exercise.ref === "back-squat",
		)!
		expect(plan.target).toEqual(
			expect.objectContaining({ kg: 60, basis: "hold" }),
		)
		expect(built.conditioningLogged).toBeNull()
	})

	it("picks today's conditioning entry, and only today's", () => {
		const done: LogEntry = {
			kind: "conditioning",
			schemaVersion: LOG_SCHEMA_VERSION,
			id: "22222222-2222-4222-8222-222222222222",
			date: "2026-08-17",
			category: "Cardio",
			workout: "cardio go",
			level: 3,
			sets: 5,
		}
		const built = buildIndexView(
			SITE,
			"2026-08-17",
			{ kind: "conditioning", title: "Cardio" },
			[priorSquat, { ...done, id: done.id, date: "2026-08-17" }],
		)
		expect(built.conditioningLogged?.workout).toBe("cardio go")
		expect(built.session).toBeNull()

		const otherDay = buildIndexView(
			SITE,
			"2026-08-18",
			{ kind: "conditioning", title: "Cardio" },
			[done],
		)
		expect(otherDay.conditioningLogged).toBeNull()
	})

	it("carries nothing to compute on a rest day", () => {
		const built = buildIndexView(SITE, "2026-08-17", { kind: "rest" }, [])
		expect(built.session).toBeNull()
		expect(built.conditioningLogged).toBeNull()
	})
})
