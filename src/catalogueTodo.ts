import { ratingLabels } from "./components/catalogue/reviewUtils"

/**
 * Progress of the catalogue against curated to-do lists. Each list is tied to a
 * catalogue source (TMDB_MOVIE, IGDB, …) and its entries are keyed by that
 * source's id, so an entry counts as done when a matching review exists.
 */

export interface TodoEntry {
	/** The source's review id: a number for TMDB/IGDB, an edition OLID string for Open Library books. */
	id: number | string
	name: string
	year: number | null
	poster: string | null
	/** External page for an entry that hasn't been reviewed yet (TMDB, IGDB, …). */
	link: string
	/**
	 * Searchable catalogue-style metadata, pipe-delimited like a review's `meta`.
	 * Absent on lists built before enrichment, so search must tolerate it missing.
	 */
	meta?: string
}

export interface TodoList {
	id: string
	title: string
	description: string
	source: string
	url?: string
	entries: TodoEntry[]
}

export interface TodoItem {
	id: number | string
	name: string
	year: number | null
	poster: string | null
	done: boolean
	emoji: string | null
	href: string
	/** Searchable catalogue-style metadata; see {@link TodoEntry.meta}. */
	meta?: string
}

export interface TodoProgress {
	total: number
	doneCount: number
	percent: number
}

/** Keyed by source id. */
export interface TodoReview {
	rating: number
	emotions: number[]
}

export interface TodoEmotion {
	emoji: string
	name: string
}

export interface TodoStats {
	/** Emoji + verb for the rounded-average rating across reviewed entries. */
	averageEmoji: string
	averageVerb: string
	/** The three most-felt emotions, most frequent first. */
	emotions: TodoEmotion[]
}

export const SORTS = ["year-asc", "year-desc"] as const
export const STATUSES = ["all", "done", "todo"] as const
export type TodoSort = (typeof SORTS)[number]
export type TodoStatus = (typeof STATUSES)[number]

export interface ReviewRow {
	source_id: string | number
	source_name: string
	source_img: string
	rating: number
	emotions: string
}

/**
 * Index a source's reviews by source id, keeping the newest per id (rows must
 * arrive newest-first). Ids are trimmed — some stored rows carry a stray leading
 * space that wouldn't match an entry's id otherwise. `names` holds each review's
 * `source_name` (the catalogue's exact "Title (Year)" string) for deep-linking,
 * `posters` its `source_img` so a done entry can show the catalogue's own poster.
 */
export function indexReviews(rows: ReviewRow[]): {
	done: Map<string, string>
	reviews: Map<string, TodoReview>
	names: Map<string, string>
	posters: Map<string, string>
} {
	const done = new Map<string, string>()
	const reviews = new Map<string, TodoReview>()
	const names = new Map<string, string>()
	const posters = new Map<string, string>()
	for (const row of rows) {
		const id = String(row.source_id).trim()
		if (done.has(id)) continue
		done.set(id, ratingLabels[row.rating]?.emoji ?? "")
		reviews.set(id, {
			rating: row.rating,
			emotions: JSON.parse(row.emotions ?? "[]") as number[],
		})
		names.set(id, row.source_name)
		posters.set(id, row.source_img)
	}
	return { done, reviews, names, posters }
}

/**
 * Turn a list into grid items. A done entry links to the catalogue filtered to
 * its review — querying the review's own `source_name` so the deep-link surfaces
 * that one review rather than every title-alike — and shows the review's own
 * poster (`source_img`) so a seen film matches the catalogue exactly. Everything
 * else keeps the entry's title, poster, and external link. Both fall back to the
 * entry when a review value is missing. Maps are keyed by the review's source_id
 * as a string, so numeric and OLID ids match alike.
 */
export function buildTodoItems(
	list: TodoList,
	done: Map<string, string>,
	names: Map<string, string> = new Map(),
	posters: Map<string, string> = new Map(),
): TodoItem[] {
	return list.entries.map((entry) => {
		const id = String(entry.id)
		const emoji = done.get(id)
		const query = names.get(id) ?? entry.name
		const reviewPoster = emoji !== undefined ? posters.get(id) : undefined
		return {
			id: entry.id,
			name: entry.name,
			year: entry.year,
			poster: reviewPoster || entry.poster,
			done: emoji !== undefined,
			emoji: emoji ?? null,
			href:
				emoji !== undefined
					? `/catalogue?query=${encodeURIComponent(query)}&source=${list.source}`
					: entry.link,
			meta: entry.meta,
		}
	})
}

export function computeTodoProgress(items: TodoItem[]): TodoProgress {
	const doneCount = items.filter((item) => item.done).length
	const total = items.length
	const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100)
	return { total, doneCount, percent }
}

/**
 * Aggregate a list's reviewed entries into a rounded-average rating and the
 * three most-felt emotions. Returns null until at least `minReviews` entries
 * are reviewed, so the caller can hide the line while a handful of ratings
 * wouldn't yet say anything meaningful.
 */
export function computeTodoStats(
	items: TodoItem[],
	reviews: Map<string, TodoReview>,
	emotions: Map<string, TodoEmotion>,
	minReviews = 3,
): TodoStats | null {
	const done = items
		.filter((item) => item.done)
		.map((item) => reviews.get(String(item.id)))
		.filter((review): review is TodoReview => review !== undefined)

	if (done.length < minReviews) return null

	const average = Math.round(
		done.reduce((sum, review) => sum + review.rating, 0) / done.length,
	)

	const counts = new Map<string, number>()
	for (const review of done)
		for (const id of review.emotions) {
			const key = String(id)
			counts.set(key, (counts.get(key) ?? 0) + 1)
		}

	// Resolve names before slicing so unknown ids never take a top-three slot;
	// break count ties alphabetically for a stable order.
	const top = [...counts.entries()]
		.map(([id, count]) => ({ emotion: emotions.get(id), count }))
		.filter(
			(entry): entry is { emotion: TodoEmotion; count: number } =>
				entry.emotion !== undefined,
		)
		.sort(
			(a, b) =>
				b.count - a.count || a.emotion.name.localeCompare(b.emotion.name),
		)
		.slice(0, 3)
		.map((entry) => entry.emotion)

	const label = ratingLabels[average]
	return {
		averageEmoji: label?.emoji ?? "",
		averageVerb: label?.verb ?? "",
		emotions: top,
	}
}

/** Returns HTML; emotion names are trusted catalogue data italicised inline. */
export function formatTodoStats(stats: TodoStats): string {
	const felt = stats.emotions
		.map((emotion) => `<i>${emotion.name}</i>`)
		.join(", ")
	return `On average ${stats.averageVerb} ${stats.averageEmoji}, and mostly felt ${felt}.`
}

/** Filter by a case-insensitive query (title + meta) and done/to-do status. */
export function filterTodoItems(
	items: TodoItem[],
	options: { query?: string; status?: TodoStatus },
): TodoItem[] {
	const query = (options.query ?? "").trim().toLowerCase()
	const status = options.status ?? "all"
	return items.filter((item) => {
		if (status === "done" && !item.done) return false
		if (status === "todo" && item.done) return false
		if (query) {
			const haystack = `${item.name} ${item.meta ?? ""}`.toLowerCase()
			if (!haystack.includes(query)) return false
		}
		return true
	})
}

/** Sort by release year (direction from sort), breaking ties alphabetically. */
export function sortTodoItems(items: TodoItem[], sort: TodoSort): TodoItem[] {
	const direction = sort === "year-desc" ? -1 : 1
	return [...items].sort((a, b) => {
		const yearDelta = (a.year ?? 0) - (b.year ?? 0)
		if (yearDelta !== 0) return yearDelta * direction
		return a.name.localeCompare(b.name)
	})
}
