/**
 * Date helpers for the cataloguer's backfill modes. Drawing an unused day from a
 * life era keeps the catalogue timeline collision-free. Days are `yyyy-mm-dd` in
 * UTC, matching how `inserted_at` is stored.
 */

export type DateMode =
	"custom" | "today" | "post-covid" | "pre-covid" | "adolescence" | "jeunesse"

export type EraMode = Exclude<DateMode, "custom" | "today">

/** Both years inclusive. */
export interface EraRange {
	readonly startYear: number
	readonly endYear: number
}

/** Life eras and the years each draws from; ranges must not overlap. */
export const ERA_RANGES: Record<EraMode, EraRange> = {
	"post-covid": { startYear: 2020, endYear: 2024 },
	"pre-covid": { startYear: 2015, endYear: 2019 },
	adolescence: { startYear: 2008, endYear: 2014 },
	jeunesse: { startYear: 2003, endYear: 2007 },
}

const MS_PER_DAY = 86_400_000

export function toIsoDay(date: Date): string {
	return date.toISOString().slice(0, 10)
}

/** The *local* (not UTC) calendar day as `yyyy-mm-dd`. */
export function todayIsoDay(now: Date = new Date()): string {
	const year = now.getFullYear()
	const month = String(now.getMonth() + 1).padStart(2, "0")
	const day = String(now.getDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}

export function listDaysInRange({ startYear, endYear }: EraRange): string[] {
	const days: string[] = []
	const end = Date.UTC(endYear + 1, 0, 1)
	for (let t = Date.UTC(startYear, 0, 1); t < end; t += MS_PER_DAY) {
		days.push(toIsoDay(new Date(t)))
	}
	return days
}

/** A random free day of `range`, or `null` once every day is used. */
export function pickRandomFreeDate(
	range: EraRange,
	usedDays: ReadonlySet<string>,
	random: () => number = Math.random,
): string | null {
	const free = listDaysInRange(range).filter((day) => !usedDays.has(day))
	if (free.length === 0) return null
	const index = Math.min(free.length - 1, Math.floor(random() * free.length))
	return free[index] ?? null
}
