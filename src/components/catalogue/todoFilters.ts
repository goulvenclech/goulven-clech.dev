/**
 * URL state for the catalogue to-do page, mirroring catalogueFilters: default
 * values are omitted so a bare URL means "the default list, no filters", and
 * only the keys present in the URL are read back.
 */
import {
	SORTS,
	STATUSES,
	type TodoSort,
	type TodoStatus,
} from "$src/catalogue/todo"

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

export const DEFAULT_SORT: TodoSort = "year-asc"
export const DEFAULT_STATUS: TodoStatus = "all"
/** Pinned so the landing view doesn't drift as lists are added or renamed. */
export const DEFAULT_LIST_ID = "movies-everyone-should-watch"

/**
 * Single answer to "which list does no list in the URL mean", asked by the
 * server render, the URL state and the client's landing view alike.
 */
export function defaultTodoListId(listIds: string[]): string {
	return listIds.includes(DEFAULT_LIST_ID)
		? DEFAULT_LIST_ID
		: (listIds[0] ?? "")
}

export interface TodoState {
	list: string
	query: string
	sort: TodoSort
	status: TodoStatus
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
				: defaultTodoListId(listIds),
		query: filters.query ?? "",
		sort: coerce(filters.sort, SORTS, DEFAULT_SORT),
		status: coerce(filters.status, STATUSES, DEFAULT_STATUS),
	}
}

function coerce<T extends string>(
	value: string | undefined,
	allowed: readonly T[],
	fallback: T,
): T {
	return value && (allowed as readonly string[]).includes(value)
		? (value as T)
		: fallback
}

export function buildTodoParams(
	filters: TodoFilters,
	listIds: string[],
): URLSearchParams {
	const params = new URLSearchParams()
	if (filters.list && filters.list !== defaultTodoListId(listIds))
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
