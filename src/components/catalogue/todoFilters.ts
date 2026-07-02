/**
 * URL state for the catalogue to-do page, mirroring catalogueFilters: default
 * values are omitted so a bare URL means "first list, no filters", and only the
 * keys present in the URL are read back.
 */

export interface TodoFilters {
	list: string
	query: string
	sort: string
	status: string
}

const FILTER_KEYS = [
	"list",
	"query",
	"sort",
	"status",
] as const satisfies ReadonlyArray<keyof TodoFilters>

export const DEFAULT_SORT = "year-asc"
export const DEFAULT_STATUS = "all"
export const SORTS = ["year-asc", "year-desc"]
export const STATUSES = ["all", "done", "todo"]

export interface TodoState {
	list: string
	query: string
	sort: string
	status: string
}

/** Unknown list ids and out-of-range sort/status values fall back to defaults. */
export function resolveTodoState(
	params: URLSearchParams,
	listIds: string[],
): TodoState {
	const filters = filtersFromUrl(params)
	return {
		list:
			filters.list && listIds.includes(filters.list)
				? filters.list
				: (listIds[0] ?? ""),
		query: filters.query ?? "",
		sort:
			filters.sort && SORTS.includes(filters.sort)
				? filters.sort
				: DEFAULT_SORT,
		status:
			filters.status && STATUSES.includes(filters.status)
				? filters.status
				: DEFAULT_STATUS,
	}
}

export function buildTodoParams(
	filters: TodoFilters,
	defaults: { list: string },
): URLSearchParams {
	const params = new URLSearchParams()
	if (filters.list && filters.list !== defaults.list)
		params.set("list", filters.list)
	if (filters.query) params.set("query", filters.query)
	if (filters.sort && filters.sort !== DEFAULT_SORT)
		params.set("sort", filters.sort)
	if (filters.status && filters.status !== DEFAULT_STATUS)
		params.set("status", filters.status)
	return params
}

export function filtersFromUrl(params: URLSearchParams): Partial<TodoFilters> {
	const out: Partial<TodoFilters> = {}
	for (const key of FILTER_KEYS) {
		if (params.has(key)) out[key] = params.get(key) ?? ""
	}
	return out
}
