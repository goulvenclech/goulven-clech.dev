import { addDays, isoWeekOf, lastIsoWeeks } from "./dates"
import {
	EXERCISES,
	MOVEMENT_PATTERNS,
	exerciseBySlug,
	programFor,
	type Exercise,
	type MovementPattern,
} from "./program"
import type { SessionStatus } from "./sessionValidation"

/** Default windows, shared with the stats screen so fetch horizons stay in sync. */
export const TREND_WEEKS = 12
export const ADHERENCE_DAYS = 28

export interface LoggedSet {
	date: string
	exercise: string
	pattern: string
	weight_kg: number | null
	reps: number
}

export interface LoggedSession {
	date: string
	status: SessionStatus
}

/** Epley estimate; a single rep already is the max. Null for bodyweight sets. */
export function epleyOneRepMax(
	weightKg: number | null,
	reps: number,
): number | null {
	if (weightKg === null || reps < 1) return null
	return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

export interface WeeklyPoint {
	week: string
	value: number | null
}

export interface OneRepMaxTrend {
	exercise: Exercise
	points: WeeklyPoint[]
}

/**
 * Best estimated 1RM per ISO week over the trailing window, one trend per
 * main lift that has at least one weighted set in the window.
 */
export function oneRepMaxTrends(
	sets: LoggedSet[],
	today: string,
	weeks = TREND_WEEKS,
): OneRepMaxTrend[] {
	const weekKeys = lastIsoWeeks(today, weeks)
	const bests = new Map<string, Map<string, number>>()

	for (const set of sets) {
		const exercise = exerciseBySlug(set.exercise)
		if (!exercise?.main) continue
		const estimate = epleyOneRepMax(set.weight_kg, set.reps)
		if (estimate === null) continue
		const week = isoWeekOf(set.date)
		if (!weekKeys.includes(week)) continue
		const byWeek = bests.get(exercise.slug) ?? new Map<string, number>()
		byWeek.set(week, Math.max(byWeek.get(week) ?? 0, estimate))
		bests.set(exercise.slug, byWeek)
	}

	return EXERCISES.filter(
		(exercise) => exercise.main && bests.has(exercise.slug),
	).map((exercise) => ({
		exercise,
		points: weekKeys.map((week) => ({
			week,
			value: bests.get(exercise.slug)?.get(week) ?? null,
		})),
	}))
}

/** Total kg moved (weight × reps) per ISO week; bodyweight sets count zero. */
export function weeklyTonnage(
	sets: LoggedSet[],
	today: string,
	weeks = TREND_WEEKS,
): WeeklyPoint[] {
	const weekKeys = lastIsoWeeks(today, weeks)
	const totals = new Map<string, number>()

	for (const set of sets) {
		if (set.weight_kg === null) continue
		const week = isoWeekOf(set.date)
		totals.set(week, (totals.get(week) ?? 0) + set.weight_kg * set.reps)
	}

	return weekKeys.map((week) => ({ week, value: totals.get(week) ?? 0 }))
}

/** Sets per movement pattern over the trailing `days` days, zeroes included. */
export function setsByPattern(
	sets: LoggedSet[],
	today: string,
	days = 7,
): { pattern: MovementPattern; count: number }[] {
	const from = addDays(today, -(days - 1))
	const counts = new Map<string, number>()

	for (const set of sets) {
		if (set.date < from || set.date > today) continue
		counts.set(set.pattern, (counts.get(set.pattern) ?? 0) + 1)
	}

	return MOVEMENT_PATTERNS.map((pattern) => ({
		pattern,
		count: counts.get(pattern) ?? 0,
	}))
}

export interface Adherence {
	done: number
	planned: number
	/** Done over planned; usually 0..1, may briefly exceed 1 after a program change. */
	ratio: number
}

/**
 * Trailing-window adherence: sessions done (completed or partial) over the
 * scheduled (non-rest) days in the window. The current day joins the
 * denominator only once its session is logged, so an unfinished morning
 * doesn't read as a miss. `planned` intentionally tracks the current program:
 * after a program change the ratio drifts, then self-heals within the window.
 * `done` counts stored rows only, so past sessions are never re-judged.
 */
export function adherence(
	sessions: LoggedSession[],
	today: string,
	days = ADHERENCE_DAYS,
): Adherence {
	const from = addDays(today, -(days - 1))

	let planned = 0
	for (let i = 0; i < days - 1; i++)
		if (programFor(addDays(from, i)).kind !== "rest") planned++
	if (
		programFor(today).kind !== "rest" &&
		sessions.some((session) => session.date === today)
	)
		planned++

	const done = sessions.filter(
		(session) =>
			session.date >= from &&
			session.date <= today &&
			session.status !== "skipped",
	).length

	return { done, planned, ratio: planned === 0 ? 0 : done / planned }
}
