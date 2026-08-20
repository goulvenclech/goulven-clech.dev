import exercisesJson from "../data/exercises.json"
import planJson from "../data/program.json"
import { weekdayOf } from "./dates"
import {
	catalogueSchema,
	sessionFileSchema,
	weeklyPlanSchema,
	type Catalogue,
	type Exercise,
	type PlanDay,
	type SessionTemplate,
	type WeeklyPlan,
} from "./schemas"

/**
 * The programme lives in data/*.json, parsed and cross-checked at module
 * load: a bad file fails `astro build`, never a session at the gym.
 */

export const EXERCISES = catalogueSchema.parse(exercisesJson)

const sessionFiles = import.meta.glob("../data/sessions/*.json", {
	eager: true,
	import: "default",
})

export const SESSIONS: Record<string, SessionTemplate> = Object.fromEntries(
	Object.entries(sessionFiles).map(([path, raw]) => {
		const id = path
			.split("/")
			.at(-1)!
			.replace(/\.json$/, "")
		return [id, { id, ...sessionFileSchema.parse(raw) }]
	}),
)

export const WEEKLY_PLAN = weeklyPlanSchema.parse(planJson)

export function crossCheckProgram(
	catalogue: Catalogue,
	sessions: Record<string, SessionTemplate>,
	plan: WeeklyPlan,
): void {
	const unitByRef = new Map<string, { unit: string; sessionId: string }>()
	for (const session of Object.values(sessions))
		for (const planned of session.exercises) {
			const exercise = catalogue[planned.ref]
			if (!exercise)
				throw new Error(
					`Session "${session.id}" references unknown exercise "${planned.ref}"`,
				)
			if (exercise.main && planned.progression !== "auto")
				throw new Error(
					`Main lift "${planned.ref}" in "${session.id}" must progress automatically: it drives the 1RM trend`,
				)
			// History merges by ref, so a ref must count the same unit everywhere.
			const seen = unitByRef.get(planned.ref)
			if (seen && seen.unit !== planned.unit)
				throw new Error(
					`Exercise "${planned.ref}" is counted in "${seen.unit}" in "${seen.sessionId}" but "${planned.unit}" in "${session.id}"`,
				)
			unitByRef.set(planned.ref, { unit: planned.unit, sessionId: session.id })
		}

	for (const day of plan)
		if (day.kind === "strength" && !(day.session in sessions))
			throw new Error(`Weekly plan references unknown session "${day.session}"`)
}

crossCheckProgram(EXERCISES, SESSIONS, WEEKLY_PLAN)

export function exerciseByRef(ref: string): Exercise | null {
	return EXERCISES[ref] ?? null
}

export function planFor(date: string): PlanDay {
	return WEEKLY_PLAN[weekdayOf(date)]
}
