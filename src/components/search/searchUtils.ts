import type { BlogEntry } from "src/utils"

export interface FilterState {
	query: string
	tag: string
	year: string
	sort: "date"
}

/**
 * Filter blog entries by search query, tag, and year.
 * Query is split into space-separated keywords, ALL must match in title, abstract, or tags.
 */
export function filterBlogEntries(
	entries: readonly BlogEntry[],
	filters: FilterState,
): BlogEntry[] {
	return entries.filter((entry) => {
		if (filters.query) {
			const searchKeywords = filters.query.toLowerCase().split(" ")
			const matchesQuery = searchKeywords.every(
				(keyword) =>
					entry.title.toLowerCase().includes(keyword) ||
					entry.abstract.toLowerCase().includes(keyword) ||
					entry.tags.some((tag) => tag.toLowerCase().includes(keyword)),
			)
			if (!matchesQuery) return false
		}

		if (filters.tag) {
			const hasTag = entry.tags.some(
				(tag) => tag.toLowerCase() === filters.tag.toLowerCase(),
			)
			if (!hasTag) return false
		}

		if (filters.year) {
			if (entry.year !== parseInt(filters.year)) return false
		}

		return true
	})
}

/**
 * Sort blog entries by date, newest first.
 */
export function sortBlogEntries(entries: readonly BlogEntry[]): BlogEntry[] {
	const sorted = [...entries]
	return sorted.sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	)
}
