import { daysBetween } from "./dates"
import {
	isAutoPlanned,
	type AutoPlannedExercise,
	type Catalogue,
	type Exercise,
	type LogEntry,
	type PlannedExercise,
	type SessionTemplate,
	type Unit,
} from "./schemas"

/**
 * No state is ever stored: targets are recomputed from the append-only log,
 * so a programme redesign or a restored backup can never disagree with
 * derived data.
 */

export const STALL_SESSIONS = 3
export const STALL_DELOAD = 0.1
export const LAYOFF_DAYS = 14
export const LAYOFF_DELOAD = 0.12

export interface PerformedSet {
	kg: number
	/** The count in `unit`: repetitions, metres, or seconds. */
	reps: number
	rir: number
	unit: Unit
}

/** All sets of one exercise on one day, in set order. */
export interface Performance {
	date: string
	sets: PerformedSet[]
}

/** Chronological performances of one exercise. */
export function exercisePerformances(
	log: readonly LogEntry[],
	ref: string,
): Performance[] {
	const byDate = new Map<string, { set: number; performed: PerformedSet }[]>()
	for (const entry of log) {
		if (entry.kind !== "strength" || entry.ref !== ref) continue
		const sets = byDate.get(entry.date) ?? []
		sets.push({
			set: entry.set,
			performed: {
				kg: entry.kg,
				reps: entry.reps,
				rir: entry.rir,
				// Raw IndexedDB rows predating the unit field default to reps.
				unit: entry.unit ?? "reps",
			},
		})
		byDate.set(entry.date, sets)
	}
	return [...byDate.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, sets]) => ({
			date,
			sets: sets.sort((a, b) => a.set - b.set).map((entry) => entry.performed),
		}))
}

export type TargetBasis = "progress" | "hold" | "stall-deload" | "layoff-deload"

export interface Target {
	kg: number
	reps: number
	basis: TargetBasis
}

function harder(kg: number, increment: number, exercise: Exercise): number {
	return exercise.direction === "ascending"
		? kg + increment
		: Math.max(0, kg - increment)
}

function deloaded(kg: number, fraction: number, exercise: Exercise): number {
	return exercise.direction === "ascending"
		? kg * (1 - fraction)
		: kg * (1 + fraction)
}

function roundToIncrement(kg: number, increment: number): number {
	// toFixed sponges up float noise like 77.50000000000001.
	return Number((Math.round(kg / increment) * increment).toFixed(2))
}

function workingKg(performance: Performance, exercise: Exercise): number {
	const kgs = performance.sets.map((set) => set.kg)
	return exercise.direction === "ascending"
		? Math.max(...kgs)
		: Math.min(...kgs)
}

function identical(a: Performance, b: Performance): boolean {
	return (
		a.sets.length === b.sets.length &&
		a.sets.every(
			(set, i) => set.kg === b.sets[i].kg && set.reps === b.sets[i].reps,
		)
	)
}

function stalled(history: Performance[]): boolean {
	if (history.length < STALL_SESSIONS) return false
	const last = history.slice(-STALL_SESSIONS)
	return last.every((performance) => identical(performance, last[0]))
}

/**
 * Double progression over `history`, the performances strictly before today.
 * Null means no history: the UI asks for a starting load.
 */
export function nextTarget(
	planned: AutoPlannedExercise,
	exercise: Exercise,
	history: Performance[],
	date: string,
): Target | null {
	const last = history.at(-1)
	if (!last) return null
	const kg = workingKg(last, exercise)

	const deload = (fraction: number, basis: TargetBasis): Target => ({
		kg: roundToIncrement(deloaded(kg, fraction, exercise), planned.increment),
		reps: planned.reps.min,
		basis,
	})

	if (daysBetween(last.date, date) > LAYOFF_DAYS)
		return deload(LAYOFF_DELOAD, "layoff-deload")
	if (stalled(history)) return deload(STALL_DELOAD, "stall-deload")

	const complete =
		last.sets.length >= planned.sets &&
		last.sets.every((set) => set.reps >= planned.reps.max)
	if (complete)
		return {
			kg: harder(kg, planned.increment, exercise),
			reps: planned.reps.min,
			basis: "progress",
		}

	const lowestReps = Math.min(...last.sets.map((set) => set.reps))
	return {
		kg,
		reps: Math.min(planned.reps.max, lowestReps + 1),
		basis: "hold",
	}
}

export interface ExercisePlan {
	ref: string
	exercise: Exercise
	planned: PlannedExercise
	/** Computed for auto entries only; manual entries always carry null. */
	target: Target | null
	/** Last performance strictly before today, in the planned unit. */
	previous: Performance | null
	loggedToday: PerformedSet[]
}

export interface DaySession {
	id: string
	name: string
	exercises: ExercisePlan[]
}

/** Entries logged today never feed the target. */
export function todaysSession(
	template: SessionTemplate,
	catalogue: Catalogue,
	log: readonly LogEntry[],
	date: string,
): DaySession {
	return {
		id: template.id,
		name: template.name,
		exercises: template.exercises.map((planned) => {
			const exercise = catalogue[planned.ref]
			// Unreachable for real data: program.ts cross-checks refs at build.
			if (!exercise)
				throw new Error(`Unknown exercise "${planned.ref}" in "${template.id}"`)
			const performances = exercisePerformances(log, planned.ref)
			// History in another unit must never seed a target or a prefill:
			// 40 metres is not 40 reps.
			const history = performances.filter(
				(performance) =>
					performance.date < date &&
					performance.sets.every((set) => set.unit === planned.unit),
			)
			return {
				ref: planned.ref,
				exercise,
				planned,
				target: isAutoPlanned(planned)
					? nextTarget(planned, exercise, history, date)
					: null,
				previous: history.at(-1) ?? null,
				loggedToday:
					performances.find((performance) => performance.date === date)?.sets ??
					[],
			}
		}),
	}
}

/**
 * Epley on the set closest to failure, counting the reps left in reserve.
 * Display only: the engine never consumes it.
 */
export function estimateOneRepMax(
	sets: readonly PerformedSet[],
): number | null {
	let best: { rir: number; estimate: number } | null = null
	for (const set of sets) {
		// Epley is meaningless for metres or seconds.
		if (set.unit !== "reps") continue
		const total = set.reps + set.rir
		const estimate = total === 1 ? set.kg : set.kg * (1 + total / 30)
		if (
			!best ||
			set.rir < best.rir ||
			(set.rir === best.rir && estimate > best.estimate)
		)
			best = { rir: set.rir, estimate }
	}
	return best && best.estimate
}
