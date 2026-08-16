/**
 * The catalogue's media vocabulary and the labels it renders with. Each table
 * stays total over its key set: charts index them without a fallback, so a
 * missing entry must fail the build rather than leak a raw key into the UI.
 */

/** Media sources, in the order the catalogue's own filters list them. */
export const SOURCE_ORDER = [
	"IGDB",
	"BGG",
	"TMDB_MOVIE",
	"TMDB_TV",
	"SPOTIFY",
	"OPENLIBRARY",
] as const

export type MediaSource = (typeof SOURCE_ORDER)[number]

/** Ratings from hated to favorite. */
export const RATING_ORDER = [1, 2, 3, 4, 5, 6] as const

export type Rating = (typeof RATING_ORDER)[number]

/** Source key → human-readable media noun */
export const sourceNouns: Record<string, string> = {
	IGDB: "game",
	BGG: "board game",
	TMDB_MOVIE: "movie",
	TMDB_TV: "show",
	SPOTIFY: "album",
	OPENLIBRARY: "book",
} satisfies Record<MediaSource, string>

/** Source key → plural label */
export const sourcePlurals: Record<string, string> = {
	IGDB: "video games",
	BGG: "board games",
	TMDB_MOVIE: "movies",
	TMDB_TV: "shows",
	SPOTIFY: "albums",
	OPENLIBRARY: "books",
} satisfies Record<MediaSource, string>

/** Rating → emoji + verb */
export const ratingLabels: Record<number, { emoji: string; verb: string }> = {
	1: { emoji: "😡", verb: "hated" },
	2: { emoji: "🙁", verb: "disliked" },
	3: { emoji: "😐", verb: "meh'd" },
	4: { emoji: "😀", verb: "liked" },
	5: { emoji: "😍", verb: "loved" },
	6: { emoji: "⭐", verb: "favorite" },
} satisfies Record<Rating, { emoji: string; verb: string }>

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

/**
 * One-line review detail like "😍 loved this game, felt cozy; « comment »".
 * Unknown emotion ids are dropped (soft-deleted emotions may linger in rows).
 */
export function reviewDetailText(
	row: {
		source: string
		rating: number
		emotions: string
		comment: string | null
	},
	emotionsById: Map<number, { name: string }>,
): string {
	let emotionIds: number[] = []
	try {
		emotionIds = JSON.parse(row.emotions ?? "[]") as number[]
	} catch {
		emotionIds = []
	}
	const emotionNames = emotionIds
		.map((id) => emotionsById.get(id)?.name)
		.filter((n): n is string => Boolean(n))

	const feltClause = emotionNames.length
		? `, felt ${emotionNames.join(", ")}`
		: ""
	// Collapse whitespace so a stray newline or "## " in the comment can't fake a heading
	const flatComment = row.comment?.replace(/\s+/g, " ").trim()
	const commentClause = flatComment ? `; « ${flatComment} »` : ""

	return `${ratingText(row.rating, row.source)}${feltClause}${commentClause}`
}
