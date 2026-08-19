import { weekdayOf } from "./dates"

export const MOVEMENT_PATTERNS = [
	"squat",
	"hinge",
	"push",
	"pull",
	"core",
	"conditioning",
] as const

export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number]

export interface Exercise {
	slug: string
	name: string
	pattern: MovementPattern
	/** Main lifts get an estimated 1RM trend. */
	main: boolean
}

/** WIP: just enough of a catalogue to log gym work. */
export const EXERCISES: readonly Exercise[] = [
	{ slug: "squat", name: "Back squat", pattern: "squat", main: true },
	{ slug: "bench-press", name: "Bench press", pattern: "push", main: true },
	{ slug: "deadlift", name: "Deadlift", pattern: "hinge", main: true },
	{
		slug: "overhead-press",
		name: "Overhead press",
		pattern: "push",
		main: true,
	},
	{ slug: "barbell-row", name: "Barbell row", pattern: "pull", main: true },
	{ slug: "pull-up", name: "Pull-up", pattern: "pull", main: false },
	{ slug: "push-up", name: "Push-up", pattern: "push", main: false },
	{ slug: "plank", name: "Plank", pattern: "core", main: false },
]

export function exerciseBySlug(slug: string): Exercise | null {
	return EXERCISES.find((exercise) => exercise.slug === slug) ?? null
}

export type SessionKind = "strength" | "cardio" | "combat" | "core" | "rest"

export interface ProgramDay {
	title: string
	kind: SessionKind
	location: "gym" | "home" | null
}

/** Indexed by weekday, 0 = Monday … 6 = Sunday. */
export const WEEKLY_PROGRAM: readonly ProgramDay[] = [
	{ title: "Full Body Strength", kind: "strength", location: "gym" },
	{ title: "Cardio", kind: "cardio", location: "home" },
	{ title: "Combat", kind: "combat", location: "home" },
	{ title: "Core", kind: "core", location: "home" },
	{ title: "Full Body Strength", kind: "strength", location: "gym" },
	{ title: "Cardio", kind: "cardio", location: "home" },
	{ title: "Rest", kind: "rest", location: null },
]

export function programFor(date: string): ProgramDay {
	return WEEKLY_PROGRAM[weekdayOf(date)]
}
