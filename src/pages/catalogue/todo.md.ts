import type { APIContext } from "astro"
import { getClient } from "$src/db"
import {
	buildTodoItems,
	computeTodoProgress,
	computeTodoStats,
	filterTodoItems,
	formatTodoLabel,
	formatTodoStats,
	SORTS,
	sortTodoItems,
	STATUSES,
	type TodoItem,
	type TodoProgress,
	type TodoSort,
	type TodoStatus,
} from "$src/catalogue/todo"
import { DEFAULT_SORT, DEFAULT_STATUS } from "$components/catalogue/todoFilters"
import {
	INACTIVE_LIST_IDS,
	loadTodoReviews,
	todoLists,
} from "$src/catalogue/todoData"
import { sourcePlurals } from "$src/catalogue/reviewUtils"

export const prerender = false

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface TodoPageFilters {
	list?: string
	query?: string
	status?: TodoStatus
	sort?: TodoSort
}

export interface ParsedTodoQuery {
	filters: TodoPageFilters
	limit: number
	offset: number
}

/** Invalid values degrade to defaults so a malformed URL still renders. */
export function parseTodoQuery(
	url: URL,
	listIds: readonly string[],
): ParsedTodoQuery {
	const params = url.searchParams

	const listParam = params.get("list")?.trim()
	const list = listParam && listIds.includes(listParam) ? listParam : undefined

	const query = params.get("query")?.trim() || undefined

	const statusParam = params.get("status")
	const status: TodoStatus =
		statusParam && (STATUSES as readonly string[]).includes(statusParam)
			? (statusParam as TodoStatus)
			: DEFAULT_STATUS

	const sortParam = params.get("sort")
	const sort: TodoSort =
		sortParam && (SORTS as readonly string[]).includes(sortParam)
			? (sortParam as TodoSort)
			: DEFAULT_SORT

	const limitParam = params.get("limit")
	const limit =
		limitParam && /^\d+$/.test(limitParam)
			? Math.min(Math.max(Number(limitParam), 1), MAX_LIMIT)
			: DEFAULT_LIMIT

	const offsetParam = params.get("offset")
	const offset =
		offsetParam && /^\d+$/.test(offsetParam) ? Number(offsetParam) : 0

	return { filters: { list, query, status, sort }, limit, offset }
}

/** Omits defaults so paginated URLs stay short. */
export function buildTodoQueryString(
	filters: TodoPageFilters,
	limit: number,
	offset: number,
	showHelp = true,
): string {
	const params = new URLSearchParams()
	if (filters.list) params.set("list", filters.list)
	if (filters.query) params.set("query", filters.query)
	if (filters.status && filters.status !== DEFAULT_STATUS)
		params.set("status", filters.status)
	if (filters.sort && filters.sort !== DEFAULT_SORT)
		params.set("sort", filters.sort)
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
	filters: TodoPageFilters,
	limit: number,
	offset: number,
	showHelp: boolean,
): string {
	return `${site}/catalogue/todo.md${buildTodoQueryString(filters, limit, offset, showHelp)}`
}

/**
 * A default page size jumps to MAX_LIMIT so link-bound agents cover the view
 * in as few fetches as possible.
 */
export function buildFacetUrl(
	site: string,
	filters: TodoPageFilters,
	patch: Partial<TodoPageFilters>,
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

export interface TodoListSummary {
	id: string
	title: string
	source: string
	inactive: boolean
	progress: TodoProgress
}

export function renderApiDoc(
	lists: TodoListSummary[],
	site: string,
	filters: TodoPageFilters,
	limit: number,
	offset: number,
	progress: TodoProgress | null,
): string {
	const link = (patch: Partial<TodoPageFilters>) =>
		buildFacetUrl(site, filters, patch, limit, true)

	const detailBlocks: string[] = []
	if (filters.list && progress) {
		const listLines = lists.map((l) =>
			facetLine(
				l.title,
				filters.list === l.id,
				link({ list: l.id }),
				link({ list: undefined }),
			),
		)

		const statusCounts: Record<TodoStatus, number> = {
			all: progress.total,
			done: progress.doneCount,
			todo: progress.total - progress.doneCount,
		}
		const statusLines = STATUSES.map((s) =>
			(filters.status ?? DEFAULT_STATUS) === s
				? `- ${s} (${statusCounts[s]}): active`
				: `- ${s} (${statusCounts[s]}): ${link({ status: s })}`,
		)

		const sortLines = SORTS.map((s) => {
			const label =
				s === "year-asc"
					? "year-asc (oldest first)"
					: "year-desc (newest first)"
			return (filters.sort ?? DEFAULT_SORT) === s
				? `- ${label}: active`
				: `- ${label}: ${link({ sort: s })}`
		})

		detailBlocks.push(
			"",
			"list:",
			...listLines,
			"",
			"status:",
			...statusLines,
			"",
			"sort:",
			...sortLines,
		)
	}

	return [
		"## API",
		"",
		"Pick a list below, then filter, sort, and paginate it by fetching the absolute links printed on this page. Each link applies its value, keeps the other active filters, and restarts at the first page; on a line marked `active` the link removes that value instead (status and sort always have a value, so switch them via their other lines). Some agent fetch tools only follow URLs printed verbatim (query string included) so prefer these exact links over editing the URL.",
		"",
		"Free-form parameters:",
		"- query=<text>      Case-insensitive search on item titles and their metadata (genres, people, publishers…).",
		`- limit=<1-${MAX_LIMIT}>     Default: ${DEFAULT_LIMIT}; facet links use ${MAX_LIMIT} unless you set a non-default one.`,
		"- offset=<n>        Default: 0. Use the `Next page` URL to paginate.",
		"- help=<0|1>        0 hides this API section; links then keep it hidden.",
		...detailBlocks,
		"",
		`Hide this API section: ${buildUrl(site, filters, limit, offset, false)}`,
	].join("\n")
}

export const NO_FILTERS = "No filters."

export function renderFilterSummary(
	filters: TodoPageFilters,
	site: string,
	limit: number,
	showHelp: boolean,
): string {
	// The space before ")" keeps the URL ending at whitespace, so a naive \S+
	// extractor can't swallow the paren and silently corrupt the last param.
	const removal = (patch: Partial<TodoPageFilters>) =>
		`(remove: ${buildFacetUrl(site, filters, patch, limit, showHelp)} )`

	const parts: string[] = []
	if (filters.list)
		parts.push(`list=${filters.list} ${removal({ list: undefined })}`)
	if (filters.query)
		parts.push(`query="${filters.query}" ${removal({ query: undefined })}`)
	if (filters.status && filters.status !== DEFAULT_STATUS)
		parts.push(
			`status=${filters.status} ${removal({ status: DEFAULT_STATUS })}`,
		)
	if (filters.sort && filters.sort !== DEFAULT_SORT)
		parts.push(`sort=${filters.sort} ${removal({ sort: DEFAULT_SORT })}`)
	return parts.length ? `Filters: ${parts.join(", ")}.` : NO_FILTERS
}

export function renderTodoItemLine(item: TodoItem, site: string): string {
	const label = formatTodoLabel(item)
	if (!item.done) return `- ${label}: ${item.href}`
	const href = item.href.startsWith("/catalogue?")
		? `${site}/catalogue.md${item.href.slice("/catalogue".length)}`
		: item.href.startsWith("/")
			? `${site}${item.href}`
			: item.href
	const marker = item.emoji ? `— done ${item.emoji}` : "— done"
	return `- ${label} ${marker}: ${href}`
}

export interface TodoDetailView {
	list: TodoListSummary
	description: string
	url?: string
	/** Plain text; formatTodoStats' HTML is stripped by the caller. */
	statsLine: string | null
	/** Items matching the current query/status filter, before slicing. */
	matched: number
	items: TodoItem[]
}

export interface TodoView {
	site: string
	filters: TodoPageFilters
	limit: number
	offset: number
	showHelp: boolean
	lists: TodoListSummary[]
	detail: TodoDetailView | null
}

export function renderTodo(view: TodoView): string {
	const { site, filters, limit, offset, showHelp, lists, detail } = view

	const intro = [
		"# To-do lists",
		"",
		"Curated lists I'm slowly working my way through for my catalogue — films to watch, games to play, books to read.",
		"",
		`Markdown twin of ${site}/catalogue/todo, optimized for crawlers, LLMs, and no-JS readers. See also ${site}/catalogue.md (the catalogue itself) and ${site}/index.md (blog index).`,
	].join("\n")

	const apiDoc = showHelp
		? renderApiDoc(
				lists,
				site,
				filters,
				limit,
				offset,
				detail?.list.progress ?? null,
			)
		: [
				"## API",
				"",
				`API guide hidden. Show filter, sort, and pagination options: ${buildUrl(site, filters, limit, offset, true)}`,
			].join("\n")

	const filterLine = renderFilterSummary(filters, site, limit, showHelp)

	const resultsBlock = detail
		? renderDetailBlock(
				detail,
				site,
				filters,
				limit,
				offset,
				showHelp,
				filterLine,
			)
		: renderIndexBlock(lists, site, filters, limit, showHelp, filterLine)

	return [intro, "", apiDoc, "", resultsBlock, ""].join("\n")
}

function renderIndexBlock(
	lists: TodoListSummary[],
	site: string,
	filters: TodoPageFilters,
	limit: number,
	showHelp: boolean,
	filterLine: string,
): string {
	const totalItems = lists.reduce((sum, l) => sum + l.progress.total, 0)
	const totalDone = lists.reduce((sum, l) => sum + l.progress.doneCount, 0)

	const lines = lists.map((l) => {
		const nature = sourcePlurals[l.source] ?? l.source
		const label = l.inactive
			? `${l.title} (${nature}, inactive)`
			: `${l.title} (${nature})`
		const p = l.progress
		const url = buildFacetUrl(site, filters, { list: l.id }, limit, showHelp)
		return `- ${label}: ${p.doneCount}/${p.total} done (${p.percent}%) — ${url}`
	})

	return [
		"## Lists",
		"",
		`${lists.length} lists, ${totalItems} items, ${totalDone} done. Unlabelled lists are active; \`inactive\` ones are on hold. Fetch a list URL for its items, progress, and filters.`,
		...(filterLine === NO_FILTERS ? [] : ["", filterLine]),
		"",
		...lines,
	].join("\n")
}

function renderDetailBlock(
	detail: TodoDetailView,
	site: string,
	filters: TodoPageFilters,
	limit: number,
	offset: number,
	showHelp: boolean,
	filterLine: string,
): string {
	const { list, description, url, statsLine, matched, items } = detail
	const p = list.progress

	const progressLine = `Progress: ${p.doneCount}/${p.total} done (${p.percent}%).${statsLine ? ` ${statsLine}` : ""}`
	const rangeLine =
		items.length === 0
			? `Showing 0 of ${matched}.`
			: `Showing ${offset + 1}–${offset + items.length} of ${matched}.`

	const body = items.length
		? items.map((item) => renderTodoItemLine(item, site)).join("\n")
		: "No items match these filters."

	const paginationLines: string[] = []
	if (offset + limit < matched)
		paginationLines.push(
			`Next page: ${buildUrl(site, filters, limit, offset + limit, showHelp)}`,
		)
	if (offset > 0)
		paginationLines.push(
			`Previous page: ${buildUrl(site, filters, limit, Math.max(0, offset - limit), showHelp)}`,
		)
	if (limit < MAX_LIMIT && matched > limit)
		paginationLines.push(
			`Max page size: ${buildUrl(site, filters, MAX_LIMIT, 0, showHelp)}`,
		)

	return [
		`## ${list.title}`,
		"",
		description,
		"",
		...(url ? [`Source list: ${url}`, ""] : []),
		progressLine,
		"",
		`${filterLine} ${rangeLine}`,
		"",
		body,
		...(paginationLines.length ? ["", paginationLines.join("\n")] : []),
	].join("\n")
}

export async function GET(context: APIContext): Promise<Response> {
	try {
		const { url } = context
		const site = context.site!.origin
		const { filters, limit, offset } = parseTodoQuery(
			url,
			todoLists.map((l) => l.id),
		)
		const showHelp = url.searchParams.get("help") !== "0"

		// Loads every source even in detail state, unlike the JSON API: keeping all
		// summaries in `lists` real (not silently zeroed) is worth two extra
		// queries on a cache miss.
		const { doneBySource, reviewsBySource, namesBySource, emotionsById } =
			await loadTodoReviews(getClient(), todoLists)

		const itemsByList = new Map<string, TodoItem[]>(
			todoLists.map((list) => [
				list.id,
				buildTodoItems(
					list,
					doneBySource.get(list.source) ?? new Map(),
					namesBySource.get(list.source) ?? new Map(),
				),
			]),
		)

		const lists: TodoListSummary[] = todoLists.map((list) => ({
			id: list.id,
			title: list.title,
			source: list.source,
			inactive: INACTIVE_LIST_IDS.has(list.id),
			progress: computeTodoProgress(itemsByList.get(list.id) ?? []),
		}))

		let detail: TodoDetailView | null = null
		if (filters.list) {
			const list = todoLists.find((l) => l.id === filters.list)
			const summary = lists.find((l) => l.id === filters.list)
			if (list && summary) {
				const items = itemsByList.get(list.id) ?? []
				const filtered = filterTodoItems(items, {
					query: filters.query,
					status: filters.status,
				})
				const sorted = sortTodoItems(filtered, filters.sort ?? DEFAULT_SORT)
				const stats = computeTodoStats(
					items,
					reviewsBySource.get(list.source) ?? new Map(),
					emotionsById,
				)
				detail = {
					list: summary,
					description: list.description,
					url: list.url,
					statsLine: stats
						? formatTodoStats(stats).replace(/<\/?i>/g, "")
						: null,
					matched: sorted.length,
					items: sorted.slice(offset, offset + limit),
				}
			}
		}

		const document = renderTodo({
			site,
			filters,
			limit,
			offset,
			showHelp,
			lists,
			detail,
		})

		return new Response(document, {
			status: 200,
			headers: {
				"Content-Type": "text/markdown; charset=utf-8",
				"Cache-Control": "public, max-age=3600, stale-while-revalidate=1800",
				Link: `<${site}/catalogue/todo>; rel="canonical"`,
			},
		})
	} catch (err) {
		console.error("GET /catalogue/todo.md failed:", err)
		return new Response("Unable to load to-do lists", {
			status: 500,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		})
	}
}
