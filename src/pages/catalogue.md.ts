import type { APIContext } from "astro"
import { getClient } from "$src/db"
import {
	RATING_ORDER,
	ratingLabels,
	reviewDetailText,
	SOURCE_ORDER,
	sourcePlurals,
} from "$src/catalogue/reviewUtils"
import {
	buildCountQuery,
	buildSelectQuery,
	MAX_LIMIT,
	parseReviewQuery,
	type ReviewFilters,
} from "$src/catalogue/reviewQueries"

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
	showHelp = true,
): string {
	const params = new URLSearchParams()
	if (filters.search) params.set("query", filters.search)
	if (filters.source) params.set("source", filters.source)
	if (typeof filters.rating === "number")
		params.set("rating", String(filters.rating))
	if (typeof filters.emotion === "number")
		params.set("emotion", String(filters.emotion))
	if (filters.dateFrom) params.set("after", filters.dateFrom)
	if (filters.dateTo) params.set("before", filters.dateTo)
	if (filters.sort && filters.sort !== "date") params.set("sort", filters.sort)
	if (limit !== DEFAULT_LIMIT) params.set("limit", String(limit))
	if (offset > 0) params.set("offset", String(offset))
	if (!showHelp) params.set("help", "0")
	const qs = params.toString()
	return qs ? `?${qs}` : ""
}

/**
 * Agent fetch tools tend to follow only URLs printed verbatim (query string
 * included), so every reachable view must appear somewhere as an absolute URL.
 */
function buildUrl(
	site: string,
	filters: ReviewFilters,
	limit: number,
	offset: number,
	showHelp: boolean,
): string {
	return `${site}/catalogue.md${buildQueryString(filters, limit, offset, showHelp)}`
}

/**
 * A default page size jumps to MAX_LIMIT so link-bound agents cover the view
 * in as few fetches as possible.
 */
export function buildFacetUrl(
	site: string,
	filters: ReviewFilters,
	patch: Partial<ReviewFilters>,
	limit: number,
	showHelp: boolean,
): string {
	const linkLimit = limit === DEFAULT_LIMIT ? MAX_LIMIT : limit
	return buildUrl(site, { ...filters, ...patch }, linkLimit, 0, showHelp)
}

function facetLine(
	label: string,
	active: boolean,
	setUrl: string,
	removeUrl: string,
): string {
	return active
		? `- ${label}: active — remove: ${removeUrl}`
		: `- ${label}: ${setUrl}`
}

export function renderApiDoc(
	emotions: EmotionRow[],
	site: string,
	filters: ReviewFilters,
	limit: number,
	offset: number,
): string {
	const link = (patch: Partial<ReviewFilters>) =>
		buildFacetUrl(site, filters, patch, limit, true)

	const sourceLines = SOURCE_ORDER.map((s) =>
		facetLine(
			`${s} (${sourcePlurals[s]})`,
			filters.source === s,
			link({ source: s }),
			link({ source: undefined }),
		),
	)

	const ratingLines = RATING_ORDER.map((r) =>
		facetLine(
			`${r} (${ratingLabels[r].verb})`,
			filters.rating === r,
			link({ rating: r }),
			link({ rating: undefined }),
		),
	)

	const sortLines = (["date", "rating"] as const).map((s) => {
		const label =
			s === "date" ? "date (most recent first)" : "rating (best first)"
		return (filters.sort ?? "date") === s
			? `- ${label}: active`
			: `- ${label}: ${link({ sort: s })}`
	})

	const emotionLines = emotions.length
		? emotions.map((e) =>
				facetLine(
					`${e.id} (${e.emoji} ${e.name})`,
					filters.emotion === Number(e.id),
					link({ emotion: Number(e.id) }),
					link({ emotion: undefined }),
				),
			)
		: ["- (none defined)"]

	return [
		"## API",
		"",
		"Filter, sort, and paginate by fetching the absolute links below. Each link applies its value, keeps the other active filters, and restarts at the first page; on a line marked `active` the link removes that value instead (sort always has a value, so switch it via the other sort line). Some agent fetch tools only follow URLs printed verbatim (query string included) so prefer these exact links over editing the URL.",
		"",
		"Free-form parameters:",
		"- query=<text>      Full-text search on title, comment, and source metadata.",
		"- year=<YYYY>       Reviews written in that calendar year.",
		"- after=<date>      Reviews on/after this date (YYYY or YYYY-MM-DD).",
		"- before=<date>     Reviews on/before this date (YYYY or YYYY-MM-DD).",
		`- limit=<1-${MAX_LIMIT}>     Default: ${DEFAULT_LIMIT}; facet links use ${MAX_LIMIT} unless you set a non-default one.`,
		"- offset=<n>        Default: 0. Use the `Next page` URL to paginate.",
		"- help=<0|1>        0 hides this API section; links then keep it hidden.",
		"",
		"source:",
		...sourceLines,
		"",
		"rating:",
		...ratingLines,
		"",
		"sort:",
		...sortLines,
		"",
		"emotion:",
		...emotionLines,
		"",
		`Hide this API section: ${buildUrl(site, filters, limit, offset, false)}`,
	].join("\n")
}

export function renderFilterSummary(
	filters: ReviewFilters,
	emotionsById: Map<number, EmotionRow>,
	site: string,
	limit: number,
	showHelp: boolean,
): string {
	// The space before ")" keeps the URL ending at whitespace, so a naive \S+
	// extractor can't swallow the paren and silently corrupt the last param.
	const removal = (patch: Partial<ReviewFilters>) =>
		`(remove: ${buildFacetUrl(site, filters, patch, limit, showHelp)} )`

	const parts: string[] = []
	if (filters.search)
		parts.push(`query="${filters.search}" ${removal({ search: undefined })}`)
	if (filters.source)
		parts.push(`source=${filters.source} ${removal({ source: undefined })}`)
	if (typeof filters.rating === "number")
		parts.push(`rating=${filters.rating} ${removal({ rating: undefined })}`)
	if (typeof filters.emotion === "number") {
		const e = emotionsById.get(filters.emotion)
		parts.push(
			`emotion=${filters.emotion}${e ? ` (${e.name})` : ""} ${removal({ emotion: undefined })}`,
		)
	}
	if (filters.dateFrom)
		parts.push(
			`after=${filters.dateFrom.slice(0, 10)} ${removal({ dateFrom: undefined })}`,
		)
	if (filters.dateTo)
		parts.push(
			`before=${filters.dateTo.slice(0, 10)} ${removal({ dateTo: undefined })}`,
		)
	if (filters.sort && filters.sort !== "date")
		parts.push(`sort=${filters.sort} ${removal({ sort: "date" })}`)
	return parts.length ? `Filters: ${parts.join(", ")}.` : "No filters."
}

export function renderReviewLine(
	row: DbReviewRow,
	emotionsById: Map<number, EmotionRow>,
): string {
	return `${row.source_name} — ${reviewDetailText(row, emotionsById)}`
}

export interface CatalogueView {
	site: string
	filters: ReviewFilters
	limit: number
	offset: number
	showHelp: boolean
	items: DbReviewRow[]
	hasMore: boolean
	total: number
	emotions: EmotionRow[]
}

export function renderCatalogue(view: CatalogueView): string {
	const {
		site,
		filters,
		limit,
		offset,
		showHelp,
		items,
		hasMore,
		total,
		emotions,
	} = view

	const emotionsById = new Map<number, EmotionRow>(
		emotions.map((e) => [Number(e.id), e]),
	)

	const intro = [
		"# Catalogue",
		"",
		"Where I keep track of books, movies, songs, video games, and other media I consume. Keep in mind that this is a personal catalogue, incomplete and biased.",
		"",
		`Markdown twin of ${site}/catalogue, optimized for crawlers, LLMs, and no-JS readers. See also ${site}/index.md (blog index), ${site}/catalogue/todo.md (to-do lists), ${site}/2025/catalogue-astro-turso (how this catalogue is built), and ${site}/catalogue/wrapped (yearly recap).`,
	].join("\n")

	const apiDoc = showHelp
		? renderApiDoc(emotions, site, filters, limit, offset)
		: [
				"## API",
				"",
				`API guide hidden. Show filter, sort, and pagination options: ${buildUrl(site, filters, limit, offset, true)}`,
			].join("\n")

	const filterLine = renderFilterSummary(
		filters,
		emotionsById,
		site,
		limit,
		showHelp,
	)
	const rangeLine =
		items.length === 0
			? `Showing 0 of ${total}.`
			: `Showing ${offset + 1}–${offset + items.length} of ${total}.`

	const body = items.length
		? items.map((r) => renderReviewLine(r, emotionsById)).join("\n\n")
		: "No reviews match these filters."

	const paginationLines: string[] = []
	if (hasMore)
		paginationLines.push(
			`Next page: ${buildUrl(site, filters, limit, offset + limit, showHelp)}`,
		)
	if (offset > 0)
		paginationLines.push(
			`Previous page: ${buildUrl(site, filters, limit, Math.max(0, offset - limit), showHelp)}`,
		)
	if (limit < MAX_LIMIT && total > limit)
		paginationLines.push(
			`Max page size: ${buildUrl(site, filters, MAX_LIMIT, 0, showHelp)}`,
		)

	const resultsBlock = [
		"## Results",
		"",
		`${filterLine} ${rangeLine}`,
		"",
		body,
		...(paginationLines.length ? ["", paginationLines.join("\n")] : []),
	].join("\n")

	return [intro, "", apiDoc, "", resultsBlock, ""].join("\n")
}

export async function GET(context: APIContext): Promise<Response> {
	try {
		const { url } = context
		const site = context.site!.origin
		const { filters, limit, offset } = parseReviewQuery(url, DEFAULT_LIMIT)
		const showHelp = url.searchParams.get("help") !== "0"

		const client = getClient()

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

		const document = renderCatalogue({
			site,
			filters,
			limit,
			offset,
			showHelp,
			items,
			hasMore,
			total,
			emotions: emotionsRes.rows as unknown as EmotionRow[],
		})

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
