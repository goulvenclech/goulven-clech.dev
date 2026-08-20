import { addDays, isoWeekOf, lastIsoWeeks, weekdayOf } from "./dates"
import { estimateOneRepMax, exercisePerformances } from "./engine"
import type { Catalogue, Exercise, LogEntry, WeeklyPlan } from "./schemas"

export const TREND_WEEKS = 12
export const ADHERENCE_DAYS = 28

export interface WeeklyPoint {
	week: string
	value: number | null
}

export interface OneRepMaxTrend {
	ref: string
	exercise: Exercise
	points: WeeklyPoint[]
}

/**
 * Best estimated 1RM per ISO week over the trailing window, one trend per
 * main lift performed at least once in the window.
 */
export function oneRepMaxTrends(
	log: readonly LogEntry[],
	catalogue: Catalogue,
	today: string,
	weeks = TREND_WEEKS,
): OneRepMaxTrend[] {
	const weekKeys = lastIsoWeeks(today, weeks)

	return Object.entries(catalogue).flatMap(([ref, exercise]) => {
		if (!exercise.main) return []
		const bests = new Map<string, number>()
		for (const performance of exercisePerformances(log, ref)) {
			const week = isoWeekOf(performance.date)
			if (!weekKeys.includes(week)) continue
			const estimate = estimateOneRepMax(performance.sets)
			if (estimate === null) continue
			bests.set(week, Math.max(bests.get(week) ?? 0, estimate))
		}
		if (bests.size === 0) return []
		return [
			{
				ref,
				exercise,
				points: weekKeys.map((week) => ({
					week,
					value: bests.get(week) ?? null,
				})),
			},
		]
	})
}

/**
 * Total kg moved (load × reps) per ISO week. Descending exercises (a
 * counterweight is not load moved) and metre/second sets are excluded.
 */
export function weeklyTonnage(
	log: readonly LogEntry[],
	catalogue: Catalogue,
	today: string,
	weeks = TREND_WEEKS,
): WeeklyPoint[] {
	const weekKeys = lastIsoWeeks(today, weeks)
	const totals = new Map<string, number>()

	for (const entry of log) {
		if (entry.kind !== "strength") continue
		if ((entry.unit ?? "reps") !== "reps") continue
		if (catalogue[entry.ref]?.direction !== "ascending") continue
		const week = isoWeekOf(entry.date)
		totals.set(week, (totals.get(week) ?? 0) + entry.kg * entry.reps)
	}

	return weekKeys.map((week) => ({ week, value: totals.get(week) ?? 0 }))
}

export interface Adherence {
	done: number
	planned: number
	/** Done over planned; may exceed 1 after a plan change or bonus sessions. */
	ratio: number
}

/**
 * Days with anything logged over the scheduled (non-rest) days in the window.
 * Today joins the denominator only once something is logged, so an unfinished
 * morning doesn't read as a miss. `planned` intentionally tracks the current
 * plan: after a plan change the ratio drifts, then self-heals.
 */
export function adherence(
	log: readonly LogEntry[],
	plan: WeeklyPlan,
	today: string,
	days = ADHERENCE_DAYS,
): Adherence {
	const from = addDays(today, -(days - 1))

	const loggedDates = new Set(
		log
			.map((entry) => entry.date)
			.filter((date) => date >= from && date <= today),
	)

	let planned = 0
	for (let i = 0; i < days - 1; i++)
		if (plan[weekdayOf(addDays(from, i))].kind !== "rest") planned++
	if (plan[weekdayOf(today)].kind !== "rest" && loggedDates.has(today))
		planned++

	const done = loggedDates.size
	return { done, planned, ratio: planned === 0 ? 0 : done / planned }
}
