/**
 * Progress of the catalogue against a scraped Letterboxd list.
 *
 * A list entry is "trackable" when it is a movie with a TMDB id — that is what
 * the catalogue keys `TMDB_MOVIE` reviews on. Entries without one (TV, or films
 * with no TMDB link on Letterboxd) are surfaced separately rather than counted.
 */

export interface ListEntry {
	slug: string
	type: string | null
	tmdbId: number | null
	name: string | null
	year: number | null
}

export interface ListProgress {
	/** Trackable entries (movie + TMDB id). */
	total: number
	seenCount: number
	/** Whole-number percentage of trackable entries reviewed. */
	percent: number
	seen: ListEntry[]
	unseen: ListEntry[]
	/** Entries with no movie TMDB id (TV or missing link) — not counted in totals. */
	untracked: ListEntry[]
}

/** Split a list into seen / unseen / untracked against the reviewed TMDB movie ids. */
export function computeListProgress(
	entries: ListEntry[],
	seenIds: Set<number>,
): ListProgress {
	const seen: ListEntry[] = []
	const unseen: ListEntry[] = []
	const untracked: ListEntry[] = []

	for (const entry of entries) {
		if (entry.type !== "movie" || entry.tmdbId == null) {
			untracked.push(entry)
		} else if (seenIds.has(entry.tmdbId)) {
			seen.push(entry)
		} else {
			unseen.push(entry)
		}
	}

	const total = seen.length + unseen.length
	const percent = total === 0 ? 0 : Math.round((seen.length / total) * 100)

	return { total, seenCount: seen.length, percent, seen, unseen, untracked }
}
