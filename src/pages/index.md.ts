import type { APIContext } from "astro"
import { getCollection } from "astro:content"
import { isEntryPublished, type BlogEntry } from "../blogUtils"
import {
	filterBlogEntries,
	sortBlogEntries,
} from "../components/home/searchUtils"
import { formatDate, getMyAge } from "../dateUtils"

export const prerender = false

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 50

export interface HomeFilters {
	query?: string
	tag?: string
	year?: string
}

export interface ParsedHomeQuery {
	filters: HomeFilters
	limit: number
	offset: number
}

export function parseHomeQuery(url: URL): ParsedHomeQuery {
	const params = url.searchParams

	const query = params.get("query")?.trim() || undefined
	const tag = params.get("tag")?.trim() || undefined

	const yearRaw = params.get("year")?.trim()
	const year = yearRaw && /^\d{4}$/.test(yearRaw) ? yearRaw : undefined

	const limitParam = params.get("limit")
	const limit =
		limitParam && /^\d+$/.test(limitParam)
			? Math.min(Math.max(Number(limitParam), 1), MAX_LIMIT)
			: DEFAULT_LIMIT

	const offsetParam = params.get("offset")
	const offset =
		offsetParam && /^\d+$/.test(offsetParam) ? Number(offsetParam) : 0

	return { filters: { query, tag, year }, limit, offset }
}

/** Omits defaults so pagination URLs stay short. */
export function buildHomeQueryString(
	filters: HomeFilters,
	limit: number,
	offset: number,
): string {
	const params = new URLSearchParams()
	if (filters.query) params.set("query", filters.query)
	if (filters.tag) params.set("tag", filters.tag)
	if (filters.year) params.set("year", filters.year)
	if (limit !== DEFAULT_LIMIT) params.set("limit", String(limit))
	if (offset > 0) params.set("offset", String(offset))
	const qs = params.toString()
	return qs ? `?${qs}` : ""
}

function renderApiDoc(site: string): string {
	return [
		"## API",
		"",
		"Re-request this URL with any of the query parameters below to filter and paginate the blog index. All parameters are optional.",
		"",
		"- query=<text>      Space-separated keywords; ALL must match the title, abstract, or a tag (case-insensitive).",
		"- tag=<name>        Filter by a single tag (case-insensitive). Frequent tags: `software engineering`, `game development`, `coffee`.",
		"- year=<YYYY>       Restrict to entries published in this year.",
		`- limit=<1-${MAX_LIMIT}>      Default: ${DEFAULT_LIMIT}.`,
		"- offset=<n>        Default: 0. Use the `Next page` URL to paginate.",
		"",
		"Examples:",
		`- ${site}/index.md?tag=coffee`,
		`- ${site}/index.md?tag=software+engineering&limit=10`,
		`- ${site}/index.md?query=elixir%20rust`,
		`- ${site}/index.md?year=2025`,
	].join("\n")
}

function renderFilterSummary(filters: HomeFilters): string {
	const parts: string[] = []
	if (filters.query) parts.push(`query="${filters.query}"`)
	if (filters.tag) parts.push(`tag=${filters.tag}`)
	if (filters.year) parts.push(`year=${filters.year}`)
	return parts.length ? `Filters: ${parts.join(", ")}.` : "No filters."
}

export interface EntryView {
	id: string
	title: string
	abstract: string
	tags: string[]
	date: Date
}

export function renderEntryBlock(entry: EntryView, site: string): string {
	const tagsClause = entry.tags.length ? ` in ${entry.tags[0]}` : ""
	// Collapse whitespace so a stray newline or "## " in the abstract can't fake a heading
	const flatAbstract = entry.abstract.replace(/\s+/g, " ").trim()
	const abstractClause = flatAbstract ? ` « ${flatAbstract} »` : ""
	return `[${entry.title}](${site}/${entry.id}) published ${formatDate(entry.date)}${tagsClause}${abstractClause}`
}

// Paraphrased from src/pages/index.astro — keep in rough sync.
function renderIntro(site: string): string {
	return [
		"# Hello ✌",
		"",
		`I'm Goulven Clec'h, a ${getMyAge()} yo software developer based in Toulouse, France.`,
		"",
		`Mainly working in Elixir, Rust, and TypeScript ecosystems, I'm currently a senior backend engineer at Remote, the global HR platform. I also co-founded Bruits, an open source collective building Sampo and Maudit. Learn more on my [résumé](${site}/resume).`,
		"",
		"Interested in software craftsmanship and systems reliability, I blog my journey to building maintainable, performant, and useful software. But I also love talking about game development and speciality coffee.",
		"",
		`Markdown twin of ${site}/, optimized for crawlers, LLMs, and no-JS readers. Other entry points: ${site}/llms.txt (site map), ${site}/catalogue.md (media log), ${site}/feed.xml (RSS).`,
	].join("\n")
}

export async function GET(context: APIContext): Promise<Response> {
	try {
		const { url } = context
		const site = context.site!.origin
		const { filters, limit, offset } = parseHomeQuery(url)

		// Strict visibility like feed.xml: hide drafts and future entries even in dev.
		const rawEntries = await getCollection("blog", ({ data }) =>
			isEntryPublished(data.published, true),
		)

		// Resolve `abstract_clean ?? abstract` once, and carry the Date object
		// so filter/sort/render all agree.
		const rows: (BlogEntry & { dateObj: Date })[] = rawEntries.map((e) => ({
			id: e.id,
			title: e.data.title,
			date: e.data.date.toISOString(),
			year: e.data.date.getFullYear(),
			tags: e.data.tags,
			abstract: e.data.abstract_clean ?? e.data.abstract,
			isPublished: true,
			dateObj: e.data.date,
		}))

		const filtered = filterBlogEntries(rows, {
			query: filters.query ?? "",
			tag: filters.tag ?? "",
			year: filters.year ?? "",
			sort: "date",
		})
		const sorted = sortBlogEntries(filtered) as typeof rows

		const total = sorted.length
		const page = sorted.slice(offset, offset + limit)
		const hasMore = offset + limit < total

		const resultsHeader = "## Latest blog entries"
		const filterLine = renderFilterSummary(filters)
		const rangeLine =
			page.length === 0
				? `Showing 0 of ${total}.`
				: `Showing ${offset + 1}–${offset + page.length} of ${total}.`

		const body = page.length
			? page
					.map((row) =>
						renderEntryBlock(
							{
								id: row.id,
								title: row.title,
								abstract: row.abstract,
								tags: row.tags,
								date: row.dateObj,
							},
							site,
						),
					)
					.join("\n\n")
			: "No entries match these filters."

		const paginationLines: string[] = []
		if (hasMore) {
			const nextQs = buildHomeQueryString(filters, limit, offset + limit)
			paginationLines.push(`Next page: ${site}/index.md${nextQs}`)
		}
		if (offset > 0) {
			const prevOffset = Math.max(0, offset - limit)
			const prevQs = buildHomeQueryString(filters, limit, prevOffset)
			paginationLines.push(`Previous page: ${site}/index.md${prevQs}`)
		}

		const resultsBlock = [
			resultsHeader,
			"",
			`${filterLine} ${rangeLine}`,
			"",
			body,
			...(paginationLines.length ? ["", paginationLines.join("\n")] : []),
		].join("\n")

		const document = [
			renderIntro(site),
			"",
			renderApiDoc(site),
			"",
			resultsBlock,
			"",
		].join("\n")

		return new Response(document, {
			status: 200,
			headers: {
				"Content-Type": "text/markdown; charset=utf-8",
				"Cache-Control": "public, max-age=3600, stale-while-revalidate=1800",
				Link: `<${site}/>; rel="canonical"`,
			},
		})
	} catch (err) {
		console.error("GET /index.md failed:", err)
		return new Response("Unable to load home", {
			status: 500,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		})
	}
}
