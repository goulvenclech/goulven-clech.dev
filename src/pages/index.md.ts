import type { APIContext } from "astro"
import { getCollection } from "astro:content"
import { isEntryPublished, type BlogEntry } from "../blogUtils"
import {
	filterBlogEntries,
	importantTags,
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
	showHelp = true,
): string {
	const params = new URLSearchParams()
	if (filters.query) params.set("query", filters.query)
	if (filters.tag) params.set("tag", filters.tag)
	if (filters.year) params.set("year", filters.year)
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
	filters: HomeFilters,
	limit: number,
	offset: number,
	showHelp: boolean,
): string {
	return `${site}/index.md${buildHomeQueryString(filters, limit, offset, showHelp)}`
}

/**
 * A default page size jumps to MAX_LIMIT so link-bound agents cover the view
 * in as few fetches as possible.
 */
export function buildFacetUrl(
	site: string,
	filters: HomeFilters,
	patch: Partial<HomeFilters>,
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

/** The search selector's tags plus the vocabulary /resume links into the blog. */
const FEATURED_TAGS = [
	...importantTags.map((t) => t.value),
	"remotecom",
	"enchères immo",
	"bruits",
	"game dev alliance",
]

/**
 * Tag matching is case-insensitive like filterBlogEntries'; featured tags no
 * entry carries are dropped so no facet link leads to an empty view.
 */
export function collectFacets(
	rows: readonly Pick<BlogEntry, "tags" | "year" | "date">[],
	featured: readonly string[],
): { tags: string[]; years: string[] } {
	const byDateDesc = [...rows].sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	)
	const tagByFold = new Map<string, string>()
	const years = new Set<number>()
	for (const row of byDateDesc) {
		years.add(row.year)
		for (const tag of row.tags) {
			const fold = tag.toLowerCase()
			if (!tagByFold.has(fold)) tagByFold.set(fold, tag)
		}
	}
	return {
		tags: featured
			.map((t) => tagByFold.get(t.toLowerCase()))
			.filter((t): t is string => t !== undefined),
		years: [...years].sort((a, b) => b - a).map(String),
	}
}

export function renderApiDoc(
	tags: string[],
	years: string[],
	site: string,
	filters: HomeFilters,
	limit: number,
	offset: number,
): string {
	const link = (patch: Partial<HomeFilters>) =>
		buildFacetUrl(site, filters, patch, limit, true)

	const activeTagFold = filters.tag?.toLowerCase()
	const tagLines = tags.length
		? tags.map((t) =>
				facetLine(
					t,
					activeTagFold === t.toLowerCase(),
					link({ tag: t }),
					link({ tag: undefined }),
				),
			)
		: ["- (none defined)"]

	const yearLines = years.length
		? years.map((y) =>
				facetLine(
					y,
					filters.year === y,
					link({ year: y }),
					link({ year: undefined }),
				),
			)
		: ["- (none defined)"]

	return [
		"## API",
		"",
		"Filter and paginate the blog index by fetching the absolute links below. Each link applies its value, keeps the other active filters, and restarts at the first page; on a line marked `active` the link removes that value instead. Some agent fetch tools only follow URLs printed verbatim (query string included), so prefer these exact links over editing the URL.",
		"",
		"Free-form parameters (for clients that can build URLs):",
		"- query=<text>      Space-separated keywords; ALL must match the title, abstract, or a tag (case-insensitive).",
		`- limit=<1-${MAX_LIMIT}>      Default: ${DEFAULT_LIMIT}; facet links use ${MAX_LIMIT} unless you set a non-default one.`,
		"- offset=<n>        Default: 0. Use the `Next page` URL to paginate.",
		"- help=<0|1>        0 hides this API section; links then keep it hidden.",
		"",
		"tag:",
		...tagLines,
		"- (featured subset; other tags work via tag=<name> or query=<text>)",
		"",
		"year:",
		...yearLines,
		"",
		`Hide this API section: ${buildUrl(site, filters, limit, offset, false)}`,
	].join("\n")
}

export function renderFilterSummary(
	filters: HomeFilters,
	site: string,
	limit: number,
	showHelp: boolean,
): string {
	// The space before ")" keeps the URL ending at whitespace, so a naive \S+
	// extractor can't swallow the paren and silently corrupt the last param.
	const removal = (patch: Partial<HomeFilters>) =>
		`(remove: ${buildFacetUrl(site, filters, patch, limit, showHelp)} )`

	const parts: string[] = []
	if (filters.query)
		parts.push(`query="${filters.query}" ${removal({ query: undefined })}`)
	if (filters.tag)
		parts.push(`tag=${filters.tag} ${removal({ tag: undefined })}`)
	if (filters.year)
		parts.push(`year=${filters.year} ${removal({ year: undefined })}`)
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

export interface HomeView {
	site: string
	filters: HomeFilters
	limit: number
	offset: number
	showHelp: boolean
	entries: EntryView[]
	total: number
	tags: string[]
	years: string[]
}

export function renderHome(view: HomeView): string {
	const {
		site,
		filters,
		limit,
		offset,
		showHelp,
		entries,
		total,
		tags,
		years,
	} = view

	const apiDoc = showHelp
		? renderApiDoc(tags, years, site, filters, limit, offset)
		: [
				"## API",
				"",
				`API guide hidden. Show filter and pagination options: ${buildUrl(site, filters, limit, offset, true)}`,
			].join("\n")

	const filterLine = renderFilterSummary(filters, site, limit, showHelp)
	const rangeLine =
		entries.length === 0
			? `Showing 0 of ${total}.`
			: `Showing ${offset + 1}–${offset + entries.length} of ${total}.`

	const body = entries.length
		? entries.map((e) => renderEntryBlock(e, site)).join("\n\n")
		: "No entries match these filters."

	const paginationLines: string[] = []
	if (offset + limit < total)
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
		"## Latest blog entries",
		"",
		`${filterLine} ${rangeLine}`,
		"",
		body,
		...(paginationLines.length ? ["", paginationLines.join("\n")] : []),
	].join("\n")

	return [renderIntro(site), "", apiDoc, "", resultsBlock, ""].join("\n")
}

export async function GET(context: APIContext): Promise<Response> {
	try {
		const { url } = context
		const site = context.site!.origin
		const { filters, limit, offset } = parseHomeQuery(url)
		const showHelp = url.searchParams.get("help") !== "0"

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

		const { tags, years } = collectFacets(rows, FEATURED_TAGS)

		const filtered = filterBlogEntries(rows, {
			query: filters.query ?? "",
			tag: filters.tag ?? "",
			year: filters.year ?? "",
			sort: "date",
		})
		const sorted = sortBlogEntries(filtered) as typeof rows

		const total = sorted.length
		const page = sorted.slice(offset, offset + limit)

		const document = renderHome({
			site,
			filters,
			limit,
			offset,
			showHelp,
			entries: page.map((row) => ({
				id: row.id,
				title: row.title,
				abstract: row.abstract,
				tags: row.tags,
				date: row.dateObj,
			})),
			total,
			tags,
			years,
		})

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
