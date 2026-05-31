import type { APIContext } from "astro"
import { createClient } from "@libsql/client"
import { ratingText } from "../components/catalogue/reviewUtils"
import {
	buildCountQuery,
	buildSelectQuery,
	MAX_LIMIT,
	parseReviewQuery,
	type ReviewFilters,
} from "./api/catalogue/reviewQueries"

export const prerender = false

const DEFAULT_LIMIT = 20

export interface DbReviewRow {
	source: string
	source_name: string
	rating: number
	emotions: string
	comment: string | null
	inserted_at: string
}

export interface EmotionRow {
	id: number
	emoji: string
	name: string
}

/** Omits defaults so paginated URLs stay short. */
export function buildQueryString(
	filters: ReviewFilters,
	limit: number,
	offset: number,
): string {
	const params = new URLSearchParams()
	if (filters.search) params.set("query", filters.search)
	if (filters.source) params.set("source", filters.source)
	if (typeof filters.rating === "number")
		params.set("rating", String(filters.rating))
	if (typeof filters.emotion === "number")
		params.set("emotion", String(filters.emotion))
	if (filters.sort && filters.sort !== "date") params.set("sort", filters.sort)
	if (limit !== DEFAULT_LIMIT) params.set("limit", String(limit))
	if (offset > 0) params.set("offset", String(offset))
	const qs = params.toString()
	return qs ? `?${qs}` : ""
}

const ratingLegend = "1=hated, 2=disliked, 3=meh, 4=liked, 5=loved, 6=favorite"

const sourceLegend =
	"IGDB (games), BGG (board games), TMDB_MOVIE (movies), TMDB_TV (shows), SPOTIFY (albums), OPENLIBRARY (books)"

function renderApiDoc(emotions: EmotionRow[], site: string): string {
	const emotionList = emotions.length
		? emotions.map((e) => `${e.id}:${e.emoji} ${e.name}`).join(", ")
		: "(none defined)"

	return [
		"## API",
		"",
		"Re-request this URL with any of the query parameters below to filter, sort, and paginate. All parameters are optional.",
		"",
		"- query=<text>      Full-text search on title, comment, and source metadata.",
		`- source=<code>     One of: ${sourceLegend}.`,
		`- rating=<1-6>      ${ratingLegend}.`,
		"- emotion=<id>      Filter by emotion id (see list below).",
		"- sort=date|rating  Default: date (most recent first).",
		`- limit=<1-${MAX_LIMIT}>     Default: ${DEFAULT_LIMIT}.`,
		"- offset=<n>        Default: 0. Use the `Next page` URL to paginate.",
		"",
		`Emotions (id:emoji name): ${emotionList}`,
		"",
		"Examples:",
		`- ${site}/catalogue.md?rating=6&sort=date`,
		`- ${site}/catalogue.md?source=TMDB_MOVIE&emotion=3&limit=25`,
	].join("\n")
}

function renderFilterSummary(
	filters: ReviewFilters,
	emotionsById: Map<number, EmotionRow>,
): string {
	const parts: string[] = []
	if (filters.search) parts.push(`query="${filters.search}"`)
	if (filters.source) parts.push(`source=${filters.source}`)
	if (typeof filters.rating === "number") parts.push(`rating=${filters.rating}`)
	if (typeof filters.emotion === "number") {
		const e = emotionsById.get(filters.emotion)
		parts.push(`emotion=${filters.emotion}${e ? ` (${e.name})` : ""}`)
	}
	if (filters.sort && filters.sort !== "date")
		parts.push(`sort=${filters.sort}`)
	return parts.length ? `Filters: ${parts.join(", ")}.` : "No filters."
}

export function renderReviewLine(
	row: DbReviewRow,
	emotionsById: Map<number, EmotionRow>,
): string {
	const rating = ratingText(row.rating, row.source)

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

	return `${row.source_name} — ${rating}${feltClause}${commentClause}`
}

export async function GET(context: APIContext): Promise<Response> {
	try {
		const { url } = context
		const site = context.site!.origin
		const { filters, limit, offset } = parseReviewQuery(url, DEFAULT_LIMIT)

		const client = createClient({
			url: import.meta.env.TURSO_URL,
			authToken: import.meta.env.TURSO_TOKEN,
		})

		const { sql: selectSql, args: selectArgs } = buildSelectQuery({
			...filters,
			limit: limit + 1, // one extra row → hasMore flag
			offset,
		})
		const { sql: countSql, args: countArgs } = buildCountQuery(filters)

		const [reviewsRes, countRes, emotionsRes] = await Promise.all([
			client.execute({ sql: selectSql, args: selectArgs }),
			client.execute({ sql: countSql, args: countArgs }),
			client.execute(
				"SELECT id, emoji, name FROM emotions WHERE is_deleted = false ORDER BY name",
			),
		])

		const rows = reviewsRes.rows as unknown as DbReviewRow[]
		const hasMore = rows.length > limit
		const items = rows.slice(0, limit)

		const total = Number(
			(countRes.rows[0] as unknown as { total: number | bigint }).total,
		)

		const emotions = emotionsRes.rows as unknown as EmotionRow[]
		const emotionsById = new Map<number, EmotionRow>(
			emotions.map((e) => [Number(e.id), e]),
		)

		const intro = [
			"# Catalogue",
			"",
			"Where I keep track of books, movies, songs, video games, and other media I consume. Keep in mind that this is a personal catalogue, incomplete and biased.",
			"",
			`Markdown twin of ${site}/catalogue, optimized for crawlers, LLMs, and no-JS readers. See also ${site}/2025/catalogue-astro-turso (how this catalogue is built) and ${site}/catalogue/wrapped (yearly recap).`,
		].join("\n")

		const apiDoc = renderApiDoc(emotions, site)

		const resultsHeader = "## Results"
		const filterLine = renderFilterSummary(filters, emotionsById)
		const rangeLine =
			items.length === 0
				? `Showing 0 of ${total}.`
				: `Showing ${offset + 1}–${offset + items.length} of ${total}.`

		const body = items.length
			? items.map((r) => renderReviewLine(r, emotionsById)).join("\n\n")
			: "No reviews match these filters."

		const paginationLines: string[] = []
		if (hasMore) {
			const nextQs = buildQueryString(filters, limit, offset + limit)
			paginationLines.push(`Next page: ${site}/catalogue.md${nextQs}`)
		}
		if (offset > 0) {
			const prevOffset = Math.max(0, offset - limit)
			const prevQs = buildQueryString(filters, limit, prevOffset)
			paginationLines.push(`Previous page: ${site}/catalogue.md${prevQs}`)
		}

		const resultsBlock = [
			resultsHeader,
			"",
			`${filterLine} ${rangeLine}`,
			"",
			body,
			...(paginationLines.length ? ["", paginationLines.join("\n")] : []),
		].join("\n")

		const document = [intro, "", apiDoc, "", resultsBlock, ""].join("\n")

		return new Response(document, {
			status: 200,
			headers: {
				"Content-Type": "text/markdown; charset=utf-8",
				"Cache-Control": "public, max-age=3600, stale-while-revalidate=1800",
				Link: `<${site}/catalogue>; rel="canonical"`,
			},
		})
	} catch (err) {
		console.error("GET /catalogue.md failed:", err)
		return new Response("Unable to load catalogue", {
			status: 500,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		})
	}
}
