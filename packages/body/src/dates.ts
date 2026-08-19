/**
 * Every "day" in this app is a calendar day in this zone, stored and passed
 * around as a YYYY-MM-DD string. Only `localDateOf` deals with instants; all
 * other helpers do date-only arithmetic in UTC so they stay DST-proof.
 */
export const TIME_ZONE = "Europe/Paris"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isDateString(value: unknown): value is string {
	if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false
	const [year, month, day] = value.split("-").map(Number)
	const date = new Date(Date.UTC(year, month - 1, day))
	// Date.UTC silently rolls over out-of-range parts (2026-02-30 → March 2).
	return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function localDateOf(instant: Date, timeZone = TIME_ZONE): string {
	// en-CA is the locale whose date format is exactly YYYY-MM-DD.
	return new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(instant)
}

export function addDays(date: string, days: number): string {
	const shifted = new Date(`${date}T00:00:00Z`)
	shifted.setUTCDate(shifted.getUTCDate() + days)
	return shifted.toISOString().slice(0, 10)
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(date: string): number {
	return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

/** ISO 8601 week key, e.g. "2026-W34": a week belongs to its Thursday's year. */
export function isoWeekOf(date: string): string {
	const thursday = new Date(`${date}T00:00:00Z`)
	thursday.setUTCDate(thursday.getUTCDate() - weekdayOf(date) + 3)
	const year = thursday.getUTCFullYear()
	// January 4 is always in week 1; diff the two Thursdays to get the week.
	const jan4 = new Date(Date.UTC(year, 0, 4))
	jan4.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + 3)
	const week =
		1 + Math.round((thursday.getTime() - jan4.getTime()) / (7 * 86_400_000))
	return `${year}-W${String(week).padStart(2, "0")}`
}

/** Chronological keys of the `count` ISO weeks ending with the week of `date`. */
export function lastIsoWeeks(date: string, count: number): string[] {
	const weeks: string[] = []
	for (let i = count - 1; i >= 0; i--)
		weeks.push(isoWeekOf(addDays(date, -7 * i)))
	return weeks
}

/** "Wednesday 19 August" */
export function formatDay(date: string): string {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: "UTC",
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(new Date(`${date}T00:00:00Z`))
}

/** "Wed 19 Aug" */
export function formatDayShort(date: string): string {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: "UTC",
		weekday: "short",
		day: "numeric",
		month: "short",
	}).format(new Date(`${date}T00:00:00Z`))
}
