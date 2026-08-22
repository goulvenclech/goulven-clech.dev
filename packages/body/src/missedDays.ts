import { addDays } from "./dates"
import { appendEntries, readLog } from "./logStore"
import { planFor, planTitle } from "./program"
import { LOG_SCHEMA_VERSION, type LogEntry, type SkippedEntry } from "./schemas"

/**
 * One plan cycle: long enough for a device opened weekly to fill its holes,
 * short enough that editing the plan can misstamp at most one day per weekday.
 */
const CATCH_UP_DAYS = 7

/** The log unions by id, so two devices catching up converge on one entry. */
const missedId = (date: string) =>
	`00000000-0000-4000-8000-${date.replaceAll("-", "")}0000`

/**
 * Past scheduled days with nothing recorded: never today, the day is not over,
 * and never before the log's first entry — the app was not around to miss it.
 */
export function missedDays(
	log: readonly LogEntry[],
	today: string,
): SkippedEntry[] {
	// Wellness describes the previous day, so it says nothing about attendance.
	const recorded = new Set(
		log
			.filter(
				(entry) =>
					entry.kind === "strength" ||
					entry.kind === "conditioning" ||
					entry.kind === "skipped",
			)
			.map((entry) => entry.date),
	)
	if (recorded.size === 0) return []
	const start = [...recorded].reduce((earliest, date) =>
		date < earliest ? date : earliest,
	)

	const missed: SkippedEntry[] = []
	for (let ago = CATCH_UP_DAYS; ago >= 1; ago--) {
		const date = addDays(today, -ago)
		const day = planFor(date)
		if (date < start || day.kind === "rest" || recorded.has(date)) continue
		missed.push({
			kind: "skipped",
			schemaVersion: LOG_SCHEMA_VERSION,
			id: missedId(date),
			date,
			planned: planTitle(day),
		})
	}
	return missed
}

export async function markMissedDays(today: string): Promise<number> {
	const missed = missedDays(await readLog(), today)
	if (missed.length > 0) await appendEntries(missed)
	return missed.length
}
