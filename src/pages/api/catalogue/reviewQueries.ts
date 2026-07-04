import { sourceNouns } from "../../../components/catalogue/reviewUtils"

export interface ReviewFilters {
	search?: string
	rating?: number
	emotion?: number
	source?: string
	sort?: "date" | "rating"
	/** Inclusive ISO lower/upper bounds on inserted_at. */
	dateFrom?: string
	dateTo?: string
}

export const MAX_LIMIT = 100
const VALID_SOURCES = Object.keys(sourceNouns)

const YEAR_RE = /^\d{4}$/
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

/**
 * Normalise a date filter to an inclusive ISO bound, or undefined if malformed
 * (so a bad filter is dropped, never fatal). A full ISO instant is accepted so a
 * resolved bound round-trips through pagination links. Bounds compare directly
 * against inserted_at, which is stored as UTC ISO.
 */
function toDateBound(
	value: string | null,
	edge: "start" | "end",
): string | undefined {
	if (!value) return undefined
	if (ISO_RE.test(value)) return value
	if (YEAR_RE.test(value))
		return edge === "start"
			? `${value}-01-01T00:00:00.000Z`
			: `${value}-12-31T23:59:59.999Z`
	if (DAY_RE.test(value))
		return edge === "start"
			? `${value}T00:00:00.000Z`
			: `${value}T23:59:59.999Z`
	return undefined
}

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

	// `year` is shorthand for that whole year; `after`/`before` are inclusive
	// bounds. All intersect: the latest start and the earliest end win.
	const starts = [
		toDateBound(params.get("year"), "start"),
		toDateBound(params.get("after"), "start"),
	].filter((b): b is string => b !== undefined)
	const ends = [
		toDateBound(params.get("year"), "end"),
		toDateBound(params.get("before"), "end"),
	].filter((b): b is string => b !== undefined)
	const dateFrom = starts.length
		? starts.reduce((a, b) => (a > b ? a : b))
		: undefined
	const dateTo = ends.length
		? ends.reduce((a, b) => (a < b ? a : b))
		: undefined

	return {
		filters: { search, rating, emotion, source, sort, dateFrom, dateTo },
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

	if (filters.dateFrom) {
		clauses.push("inserted_at >= ?")
		args.push(filters.dateFrom)
	}

	if (filters.dateTo) {
		clauses.push("inserted_at <= ?")
		args.push(filters.dateTo)
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
