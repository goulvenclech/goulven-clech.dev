import { z } from "zod"
import { isDateString } from "./dates"

/** Objects are strict so a misspelt field fails instead of being ignored. */

// Bounded so client-valid always implies acceptable to the sync gate.
const slug = z
	.string()
	.max(64)
	.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "expected a kebab-case slug")

const dayTitle = z.string().min(1).max(64)

const dateString = z
	.string()
	.refine(isDateString, "expected a valid YYYY-MM-DD date")

export const exerciseSchema = z
	.strictObject({
		name: z.string().min(1),
		/** Main lifts get an estimated 1RM trend. */
		main: z.boolean(),
		/**
		 * "descending" flips progression: the load is a counterweight (assisted
		 * pull-up), so progressing means removing kilograms.
		 */
		direction: z.enum(["ascending", "descending"]),
	})
	.refine(
		(exercise) => !(exercise.main && exercise.direction === "descending"),
		{
			error:
				"descending exercises cannot be main: Epley on a counterweight is meaningless",
		},
	)

/**
 * Slugs are append-only identity: retire a lift from the session templates,
 * never from the catalogue, or its past stats silently vanish.
 */
export const catalogueSchema = z.record(slug, exerciseSchema)

export type Exercise = z.infer<typeof exerciseSchema>
export type Catalogue = z.infer<typeof catalogueSchema>

/** What a set counts: repetitions, metres (carries), or seconds (holds). */
export const unitSchema = z.enum(["reps", "m", "s"])
export type Unit = z.infer<typeof unitSchema>

export const plannedExerciseSchema = z
	.strictObject({
		ref: slug,
		sets: z.number().int().positive(),
		/**
		 * "auto" is driven by the engine and its deloads; "manual" is prefilled
		 * from the last logged session and edited freely.
		 */
		progression: z.enum(["auto", "manual"]).default("auto"),
		unit: unitSchema.default("reps"),
		reps: z
			.strictObject({
				min: z.number().int().positive(),
				max: z.number().int().positive(),
			})
			.optional(),
		/** Smallest load step available for this lift, in kg. */
		increment: z.number().positive().optional(),
	})
	.superRefine((exercise, ctx) => {
		const issue = (message: string) => ctx.addIssue({ code: "custom", message })
		if (exercise.reps && exercise.reps.min > exercise.reps.max)
			issue("reps.min must not exceed reps.max")
		if (exercise.progression === "auto") {
			if (!exercise.reps) issue("auto progression needs a reps range")
			if (exercise.increment === undefined)
				issue("auto progression needs an increment")
			if (exercise.unit !== "reps")
				issue("auto progression counts reps, not metres or seconds")
		} else if (exercise.increment !== undefined)
			issue("manual entries ignore increment — remove it")
	})

export const sessionFileSchema = z.strictObject({
	name: z.string().min(1),
	exercises: z.array(plannedExerciseSchema).min(1),
})

export type PlannedExercise = z.infer<typeof plannedExerciseSchema>
export type SessionFile = z.infer<typeof sessionFileSchema>

/** The narrowing the schema enforces but the inferred type cannot express. */
export interface AutoPlannedExercise extends PlannedExercise {
	progression: "auto"
	reps: NonNullable<PlannedExercise["reps"]>
	increment: number
}

export function isAutoPlanned(
	planned: PlannedExercise,
): planned is AutoPlannedExercise {
	return (
		planned.progression === "auto" &&
		planned.reps !== undefined &&
		planned.increment !== undefined
	)
}

/** A session template, identified by its file name in data/sessions/. */
export interface SessionTemplate extends SessionFile {
	id: string
}

export const planDaySchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("strength"), session: slug }),
	z.strictObject({ kind: z.literal("conditioning"), title: dayTitle }),
	z.strictObject({ kind: z.literal("rest") }),
])

/** Indexed by weekday, 0 = Monday … 6 = Sunday. */
export const weeklyPlanSchema = z.array(planDaySchema).length(7)

export type PlanDay = z.infer<typeof planDaySchema>
export type WeeklyPlan = z.infer<typeof weeklyPlanSchema>

export const LOG_SCHEMA_VERSION = 1

export const strengthEntrySchema = z.strictObject({
	kind: z.literal("strength"),
	schemaVersion: z.literal(LOG_SCHEMA_VERSION),
	/** Client-generated identity; cross-device sync unions entries by it. */
	id: z.uuid(),
	date: dateString,
	/** Session template id at logging time; context only, never computed on. */
	session: slug,
	ref: slug,
	/** 1-based position of the set within the exercise that day. */
	set: z.number().int().positive(),
	/** Load in kg; 0 for bodyweight work, counterweight for descending. */
	kg: z.number().nonnegative(),
	/** The count in `unit`: repetitions, metres, or seconds. */
	reps: z.number().int().positive(),
	unit: unitSchema.default("reps"),
	/** Reps in reserve: how many more were left at the end of the set. */
	rir: z.number().int().min(0).max(10),
})

/** An attendance tick for home workouts; no progression is computed from them. */
export const conditioningEntrySchema = z.strictObject({
	kind: z.literal("conditioning"),
	schemaVersion: z.literal(LOG_SCHEMA_VERSION),
	id: z.uuid(),
	date: dateString,
	/** The plan's day type at logging time; never edited. */
	category: dayTitle,
	// Bounded so client-valid always implies acceptable to the sync gate.
	workout: z.string().min(1).max(200),
	level: z.number().int().min(1).max(5),
	sets: z.number().int().positive(),
})

export const logEntrySchema = z.discriminatedUnion("kind", [
	strengthEntrySchema,
	conditioningEntrySchema,
])

export type StrengthEntry = z.infer<typeof strengthEntrySchema>
export type ConditioningEntry = z.infer<typeof conditioningEntrySchema>
export type LogEntry = z.infer<typeof logEntrySchema>
