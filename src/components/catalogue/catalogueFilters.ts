export interface CatalogueFilters {
	query: string
	rating: string
	source: string
	emotion: string
	sort: string
}

const FILTER_KEYS = [
	"query",
	"rating",
	"source",
	"emotion",
	"sort",
] as const satisfies ReadonlyArray<keyof CatalogueFilters>

// Empty filters and the default sort are omitted to keep URLs short.
export function buildReviewParams(
	filters: CatalogueFilters,
	pagination?: { limit: number; offset: number },
): URLSearchParams {
	const params = new URLSearchParams()
	if (filters.query) params.set("query", filters.query)
	if (filters.rating) params.set("rating", filters.rating)
	if (filters.source) params.set("source", filters.source)
	if (filters.emotion) params.set("emotion", filters.emotion)
	if (filters.sort && filters.sort !== "date") params.set("sort", filters.sort)
	if (pagination) {
		params.set("limit", String(pagination.limit))
		params.set("offset", String(pagination.offset))
	}
	return params
}

export function toQueryString(params: URLSearchParams): string {
	const s = params.toString()
	return s ? `?${s}` : ""
}

export function filtersFromUrl(
	params: URLSearchParams,
): Partial<CatalogueFilters> {
	const out: Partial<CatalogueFilters> = {}
	for (const key of FILTER_KEYS) {
		if (params.has(key)) out[key] = params.get(key) ?? ""
	}
	return out
}
