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
	poster: string | null
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

export interface ReviewInfo {
	title: string
	emoji: string
}

export interface ListItem {
	tmdbId: number
	name: string
	year: number | null
	poster: string | null
	seen: boolean
	emoji: string | null
	href: string
}

export type ListSort = "year-asc" | "year-desc"
export type ListStatus = "all" | "seen" | "unseen"

/**
 * Turn trackable entries into grid items. Seen films link to the catalogue
 * pre-filtered to their review; unseen films link to their TMDB page.
 */
export function buildListItems(
	entries: ListEntry[],
	reviews: Map<number, ReviewInfo>,
): ListItem[] {
	const items: ListItem[] = []
	for (const entry of entries) {
		if (entry.type !== "movie" || entry.tmdbId == null) continue
		const review = reviews.get(entry.tmdbId)
		items.push({
			tmdbId: entry.tmdbId,
			name: entry.name ?? entry.slug,
			year: entry.year,
			poster: entry.poster,
			seen: review != null,
			emoji: review?.emoji ?? null,
			href: review
				? `/catalogue?query=${encodeURIComponent(review.title)}&source=TMDB_MOVIE`
				: `https://www.themoviedb.org/movie/${entry.tmdbId}`,
		})
	}
	return items
}

export function filterListItems(
	items: ListItem[],
	options: { query?: string; status?: ListStatus },
): ListItem[] {
	const query = (options.query ?? "").trim().toLowerCase()
	const status = options.status ?? "all"
	return items.filter((item) => {
		if (status === "seen" && !item.seen) return false
		if (status === "unseen" && item.seen) return false
		if (query && !item.name.toLowerCase().includes(query)) return false
		return true
	})
}

export function sortListItems(items: ListItem[], sort: ListSort): ListItem[] {
	const direction = sort === "year-desc" ? -1 : 1
	return [...items].sort((a, b) => {
		const yearDelta = (a.year ?? 0) - (b.year ?? 0)
		if (yearDelta !== 0) return yearDelta * direction
		return a.name.localeCompare(b.name)
	})
}
