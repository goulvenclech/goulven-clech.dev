import { addDays, isoWeekOf, lastIsoWeeks, weekdayOf } from "./dates"
import { estimateOneRepMax, exercisePerformances } from "./engine"
import type {
	Catalogue,
	Exercise,
	LogEntry,
	WeeklyPlan,
	WellnessEntry,
} from "./schemas"

export const TREND_WEEKS = 12
export const ADHERENCE_DAYS = 28
export const WELLNESS_DAYS = 28

// Halves are the finest plate increment worth displaying.
export const roundKg = (value: number): number => Math.round(value * 2) / 2

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

export interface DailyPoint {
	date: string
	value: number | null
}

export interface DailyTrend {
	points: DailyPoint[]
	/** Mean over logged days only; null when none. */
	average: number | null
}

/**
 * The window ends yesterday: sleep and steps describe the previous day, so
 * today can never have a value yet.
 */
export function dailyWellnessTrend(
	log: readonly LogEntry[],
	metric: "sleepHours" | "steps",
	today: string,
	days = WELLNESS_DAYS,
): DailyTrend {
	const values = new Map<string, number>()
	// Sorted by id so devices holding the same synced duplicates agree.
	const wellness = log
		.filter((entry): entry is WellnessEntry => entry.kind === "wellness")
		.sort((a, b) => a.id.localeCompare(b.id))
	for (const entry of wellness) {
		const value = entry[metric]
		if (value !== undefined) values.set(entry.date, value)
	}

	const end = addDays(today, -1)
	const points: DailyPoint[] = []
	for (let i = days - 1; i >= 0; i--) {
		const date = addDays(end, -i)
		points.push({ date, value: values.get(date) ?? null })
	}

	const present = points.flatMap((point) =>
		point.value === null ? [] : [point.value],
	)
	const average =
		present.length === 0
			? null
			: present.reduce((sum, value) => sum + value, 0) / present.length
	return { points, average }
}

export interface WeightTrend {
	latest: { date: string; kg: number } | null
	/** Mean of the week's readings. */
	points: WeeklyPoint[]
}

/** Weight is read twice a week at best, so days would be mostly holes. */
export function weightTrend(
	log: readonly LogEntry[],
	today: string,
	weeks = TREND_WEEKS,
): WeightTrend {
	const weekKeys = lastIsoWeeks(today, weeks)

	// One reading per day, sorted by id so every device keeps the same one.
	const daily = new Map<string, number>()
	const wellness = log
		.filter((entry): entry is WellnessEntry => entry.kind === "wellness")
		.sort((a, b) => a.id.localeCompare(b.id))
	for (const entry of wellness) {
		if (entry.weightKg === undefined) continue
		if (!weekKeys.includes(isoWeekOf(entry.date))) continue
		daily.set(entry.date, entry.weightKg)
	}

	const readings = new Map<string, number[]>()
	let latest: { date: string; kg: number } | null = null
	for (const [date, kg] of daily) {
		const week = isoWeekOf(date)
		readings.set(week, [...(readings.get(week) ?? []), kg])
		if (latest === null || date > latest.date) latest = { date, kg }
	}

	const points = weekKeys.map((week) => {
		const values = readings.get(week)
		return {
			week,
			value: values
				? values.reduce((sum, value) => sum + value, 0) / values.length
				: null,
		}
	})
	return { latest, points }
}

export interface Adherence {
	done: number
	planned: number
	/** Done over planned; may exceed 1 after a plan change or bonus sessions. */
	ratio: number
}

/**
 * Days attended over the scheduled (non-rest) days in the window. Today joins
 * the denominator only once it is settled — attended, or declared skipped —
 * so an unfinished morning doesn't read as a miss. `planned` intentionally
 * tracks the current plan: after a plan change the ratio drifts, then
 * self-heals.
 */
export function adherence(
	log: readonly LogEntry[],
	plan: WeeklyPlan,
	today: string,
	days = ADHERENCE_DAYS,
): Adherence {
	const from = addDays(today, -(days - 1))

	const attended = new Set(
		log
			// A weigh-in precedes a session that may still be abandoned, and a
			// skipped session is the record of not attending.
			.filter(
				(entry) => entry.kind === "strength" || entry.kind === "conditioning",
			)
			.map((entry) => entry.date)
			.filter((date) => date >= from && date <= today),
	)

	const skippedToday = log.some(
		(entry) => entry.kind === "skipped" && entry.date === today,
	)

	let planned = 0
	for (let i = 0; i < days - 1; i++)
		if (plan[weekdayOf(addDays(from, i))].kind !== "rest") planned++
	if (
		plan[weekdayOf(today)].kind !== "rest" &&
		(attended.has(today) || skippedToday)
	)
		planned++

	const done = attended.size
	return { done, planned, ratio: planned === 0 ? 0 : done / planned }
}
