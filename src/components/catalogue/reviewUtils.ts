/** Source key → human-readable media noun */
export const sourceNouns: Record<string, string> = {
	IGDB: "game",
	BGG: "board game",
	TMDB_MOVIE: "movie",
	TMDB_TV: "show",
	SPOTIFY: "album",
	OPENLIBRARY: "book",
}

/** Rating → emoji + verb */
export const ratingLabels: Record<number, { emoji: string; verb: string }> = {
	1: { emoji: "😡", verb: "hated" },
	2: { emoji: "🙁", verb: "disliked" },
	3: { emoji: "😐", verb: "meh'd" },
	4: { emoji: "😀", verb: "liked" },
	5: { emoji: "😍", verb: "loved" },
	6: { emoji: "⭐", verb: "favorite" },
}

/**
 * Build a rating text like "😍 loved this game" or "⭐ favorite album".
 * Falls back to "one" for unknown sources (ratings 1–5) or bare "favorite" (rating 6).
 */
export function ratingText(rating: number, source: string): string {
	const label = ratingLabels[rating]
	if (!label) return ""
	const noun = sourceNouns[source]
	if (rating === 6)
		return noun
			? `${label.emoji} ${label.verb} ${noun}`
			: `${label.emoji} ${label.verb}`
	return `${label.emoji} ${label.verb} this ${noun ?? "one"}`
}
