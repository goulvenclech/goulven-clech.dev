import { sourceNouns } from "../../../components/catalogue/reviewUtils"

export interface ReviewFilters {
	search?: string
	rating?: number
	emotion?: number
	source?: string
	sort?: "date" | "rating"
}

export const MAX_LIMIT = 100
const VALID_SOURCES = Object.keys(sourceNouns)

export interface ParsedReviewQuery {
	filters: ReviewFilters
	limit: number
	offset: number
}

/** Invalid filters degrade to `undefined` so a malformed URL is unfiltered, never a failed query. */
export function parseReviewQuery(
	url: URL,
	defaultLimit: number,
): ParsedReviewQuery {
	const params = url.searchParams

	const search = params.get("query")?.trim() || undefined

	const ratingParam = params.get("rating")
	const ratingNum = ratingParam ? Number(ratingParam) : NaN
	const rating =
		Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 6
			? ratingNum
			: undefined

	// Emotion IDs are a dynamic DB set, so only non-integers are rejected; validating existence would cost a query.
	const emotionParam = params.get("emotion")
	const emotionNum = emotionParam ? Number(emotionParam) : NaN
	const emotion = Number.isInteger(emotionNum) ? emotionNum : undefined

	const sourceParam = params.get("source") || undefined
	const source =
		sourceParam && VALID_SOURCES.includes(sourceParam) ? sourceParam : undefined

	const sort: "date" | "rating" =
		params.get("sort") === "rating" ? "rating" : "date"

	const limitParam = params.get("limit")
	const limit =
		limitParam && /^\d+$/.test(limitParam)
			? Math.min(Math.max(Number(limitParam), 1), MAX_LIMIT)
			: defaultLimit

	const offsetParam = params.get("offset")
	const offset =
		offsetParam && /^\d+$/.test(offsetParam) ? Number(offsetParam) : 0

	return {
		filters: { search, rating, emotion, source, sort },
		limit,
		offset,
	}
}

function buildWhereClause(filters: ReviewFilters): {
	where: string
	args: (string | number)[]
} {
	const clauses: string[] = []
	const args: (string | number)[] = []

	if (filters.search) {
		clauses.push("(source_name LIKE ? OR comment LIKE ? OR meta LIKE ?)")
		const like = `%${filters.search}%`
		args.push(like, like, like)
	}

	if (typeof filters.rating === "number") {
		clauses.push("rating = ?")
		args.push(filters.rating)
	}

	if (typeof filters.emotion === "number") {
		clauses.push(`EXISTS (
      SELECT 1
        FROM json_each(reviews.emotions) AS e
       WHERE e.value = ?
    )`)
		args.push(filters.emotion)
	}

	if (filters.source) {
		clauses.push("source = ?")
		args.push(filters.source)
	}

	return {
		where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "",
		args,
	}
}

export function buildSelectQuery(
	filters: ReviewFilters & { limit: number; offset?: number },
): { sql: string; args: (string | number)[] } {
	const { where, args } = buildWhereClause(filters)
	const orderBy =
		filters.sort === "rating"
			? " ORDER BY rating DESC, inserted_at DESC"
			: " ORDER BY inserted_at DESC"
	const sql = `SELECT * FROM reviews${where}${orderBy} LIMIT ? OFFSET ?`
	args.push(filters.limit, filters.offset ?? 0)
	return { sql, args }
}

export function buildCountQuery(filters: ReviewFilters): {
	sql: string
	args: (string | number)[]
} {
	const { where, args } = buildWhereClause(filters)
	return { sql: `SELECT COUNT(*) AS total FROM reviews${where}`, args }
}
