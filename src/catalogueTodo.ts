/**
 * Progress of the catalogue against curated to-do lists. Each list is tied to a
 * catalogue source (TMDB_MOVIE, IGDB, …) and its entries are keyed by that
 * source's id, so an entry counts as done when a matching review exists.
 */

export interface TodoEntry {
	id: number
	name: string
	year: number | null
	poster: string | null
	/** External page for an entry that hasn't been reviewed yet (TMDB, IGDB, …). */
	link: string
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
	id: number
	name: string
	year: number | null
	poster: string | null
	done: boolean
	emoji: string | null
	href: string
}

export interface TodoProgress {
	total: number
	doneCount: number
	percent: number
}

export type TodoSort = "year-asc" | "year-desc"
export type TodoStatus = "all" | "done" | "todo"

/**
 * Turn a list into grid items. Done entries link to the catalogue filtered to
 * their review; the rest link to their external page.
 */
export function buildTodoItems(
	list: TodoList,
	done: Map<number, string>,
): TodoItem[] {
	return list.entries.map((entry) => {
		const emoji = done.get(entry.id)
		return {
			id: entry.id,
			name: entry.name,
			year: entry.year,
			poster: entry.poster,
			done: emoji !== undefined,
			emoji: emoji ?? null,
			href:
				emoji !== undefined
					? `/catalogue?query=${encodeURIComponent(entry.name)}&source=${list.source}`
					: entry.link,
		}
	})
}

export function computeTodoProgress(items: TodoItem[]): TodoProgress {
	const doneCount = items.filter((item) => item.done).length
	const total = items.length
	const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100)
	return { total, doneCount, percent }
}

/** Filter by a case-insensitive name query and done/to-do status. */
export function filterTodoItems(
	items: TodoItem[],
	options: { query?: string; status?: TodoStatus },
): TodoItem[] {
	const query = (options.query ?? "").trim().toLowerCase()
	const status = options.status ?? "all"
	return items.filter((item) => {
		if (status === "done" && !item.done) return false
		if (status === "todo" && item.done) return false
		if (query && !item.name.toLowerCase().includes(query)) return false
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
