/**
 * Data layer for the catalogue MCP server: a thin, read-only HTTP client over
 * the public goulven-clech.dev API, plus the pure mapping/filtering helpers the
 * tools are built from. Deliberately free of any MCP SDK import so it stays
 * unit-testable on its own.
 *
 * A couple of small tables (media types, rating labels) are mirrored from the
 * website rather than imported: this package builds on its own Node toolchain,
 * without the Astro aliases the originals rely on.
 */

/** The catalogue sources, as stored server-side. */
export type Source =
	"IGDB" | "BGG" | "TMDB_MOVIE" | "TMDB_TV" | "SPOTIFY" | "OPENLIBRARY"

/** Friendly media type exposed to assistants, mapped to a server source. */
export const TYPE_TO_SOURCE = {
	game: "IGDB",
	"board-game": "BGG",
	movie: "TMDB_MOVIE",
	"tv-show": "TMDB_TV",
	album: "SPOTIFY",
	book: "OPENLIBRARY",
} as const satisfies Record<string, Source>

export type MediaType = keyof typeof TYPE_TO_SOURCE

export const MEDIA_TYPES = Object.keys(TYPE_TO_SOURCE) as [
	MediaType,
	...MediaType[],
]

const SOURCE_TO_TYPE = Object.fromEntries(
	Object.entries(TYPE_TO_SOURCE).map(([type, source]) => [source, type]),
) as Record<Source, MediaType>

/** Rating (1-6) → emoji + verb. Mirrored from the site's reviewUtils. */
export const RATING_LABELS: Record<number, { emoji: string; verb: string }> = {
	1: { emoji: "😡", verb: "hated" },
	2: { emoji: "🙁", verb: "disliked" },
	3: { emoji: "😐", verb: "meh'd" },
	4: { emoji: "😀", verb: "liked" },
	5: { emoji: "😍", verb: "loved" },
	6: { emoji: "⭐", verb: "favorite" },
}

/** A review as returned by GET /api/catalogue/reviews. */
export interface ApiReview {
	id: number
	source: string
	source_id: string
	source_name: string
	source_link: string
	source_img: string
	rating: number
	emotions: number[]
	comment: string
	inserted_at: string
	meta: string
}

/** An emotion as returned by GET /api/catalogue/emotions. */
export interface Emotion {
	id: number
	emoji: string
	name: string
}

/** An emotion resolved onto a review. */
export interface ReviewEmotion {
	id: number
	name: string
	emoji: string
}

/** Assistant-facing review: enriched, with internal display fields dropped. */
export interface Review {
	id: number
	type: MediaType | string
	title: string
	link: string
	image: string
	rating: number
	rating_label: string
	emotions: ReviewEmotion[]
	comment: string
	date: string
	meta: unknown
}

export interface SearchReviewsArgs {
	query?: string
	type?: MediaType
	rating?: number
	emotion?: string
	year?: number
	after?: string
	before?: string
	sort?: "date" | "rating"
	limit?: number
	offset?: number
}

/** Give up on a request rather than hanging the tool call indefinitely. */
const REQUEST_TIMEOUT_MS = 10_000

/** MAX_LIMIT of the reviews API; we never ask for more in one page. */
export const PAGE_SIZE = 100
/** Backstop against a server that never reports the end of the results. */
const MAX_PAGES = 50

/**
 * Caps for callers that don't ask for one: a whole catalogue or list runs to
 * hundreds of kilobytes, far past what fits in a single tool result.
 */
export const DEFAULT_SEARCH_LIMIT = 25
export const DEFAULT_TODO_LIMIT = 100

/**
 * A negative count would slice from the end of the results and quietly return
 * the wrong rows, so anything unusable falls back.
 */
function clampCount(
	value: number | undefined,
	fallback: number,
	min: number,
): number {
	if (value === undefined || !Number.isFinite(value)) return fallback
	return Math.max(min, Math.trunc(value))
}

/** Build the query string for one page of GET /api/catalogue/reviews. */
export function buildReviewSearchParams(
	args: SearchReviewsArgs,
	emotionId: number | undefined,
	limit: number,
	offset: number,
): URLSearchParams {
	const params = new URLSearchParams()
	if (args.query) params.set("query", args.query)
	if (args.type) params.set("source", TYPE_TO_SOURCE[args.type])
	if (args.rating !== undefined) params.set("rating", String(args.rating))
	if (emotionId !== undefined) params.set("emotion", String(emotionId))
	if (args.year !== undefined) params.set("year", String(args.year))
	if (args.after) params.set("after", args.after)
	if (args.before) params.set("before", args.before)
	if (args.sort) params.set("sort", args.sort)
	params.set("limit", String(limit))
	params.set("offset", String(offset))
	return params
}

const YEAR_OR_DAY = /^\d{4}(-\d{2}-\d{2})?$/

/**
 * A year, or a day that actually exists: shape alone isn't enough, since Date
 * rolls 2023-02-30 over to March rather than rejecting it.
 */
export function isRealDate(value: string): boolean {
	if (!YEAR_OR_DAY.test(value)) return false
	if (value.length === 4) return true
	const date = new Date(`${value}T00:00:00.000Z`)
	return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Resolve an emotion name (case-insensitive) to its id. */
export function resolveEmotionId(
	name: string,
	emotions: Emotion[],
): number | undefined {
	const wanted = name.trim().toLowerCase()
	return emotions.find((e) => e.name.toLowerCase() === wanted)?.id
}

/** Best-effort parse of the opaque meta JSON string. */
function parseMeta(meta: string): unknown {
	if (!meta) return null
	try {
		return JSON.parse(meta)
	} catch {
		return meta
	}
}

/** Map a raw API review to the enriched, assistant-facing shape. */
export function enrichReview(
	review: ApiReview,
	emotionsById: Map<number, Emotion>,
): Review {
	const label = RATING_LABELS[review.rating]
	return {
		id: review.id,
		type: SOURCE_TO_TYPE[review.source as Source] ?? review.source,
		title: review.source_name,
		link: review.source_link,
		image: review.source_img,
		rating: review.rating,
		rating_label: label
			? `${label.emoji} ${label.verb}`
			: String(review.rating),
		emotions: review.emotions.map((id) => {
			const emotion = emotionsById.get(id)
			return {
				id,
				name: emotion?.name ?? `#${id}`,
				emoji: emotion?.emoji ?? "",
			}
		}),
		comment: review.comment,
		date: review.inserted_at,
		meta: parseMeta(review.meta),
	}
}

export interface TodoProgress {
	total: number
	doneCount: number
	percent: number
}

export interface TodoItem {
	id: number | string
	name: string
	year: number | null
	poster: string | null
	done: boolean
	emoji: string | null
	href: string
	/** Catalogue-style metadata (genres, studio, cast); absent on older lists. */
	meta?: string
}

export interface TodoListDetail {
	id: string
	title: string
	description: string
	source: string
	url: string | null
	progress: TodoProgress
	items: TodoItem[]
}

export type TodoListSummary = Omit<TodoListDetail, "items">

export type TodoStatus = "all" | "done" | "todo"

/** A to-do entry as exposed to assistants; poster art is website-only. */
export type TodoItemView = Omit<TodoItem, "poster">

export interface TodoListView extends TodoListSummary {
	offset: number
	/** Entries matching the filter, before `limit`/`offset` were applied. */
	matched: number
	items: TodoItemView[]
}

export interface ReviewSearchResult {
	offset: number
	returned: number
	limit: number
	/** More reviews match — re-run from `offset + returned` to continue. */
	hasMore: boolean
	reviews: Review[]
}

/**
 * Read-only HTTP client over the public catalogue API. `fetchFn` is injectable
 * for testing; it defaults to the global fetch.
 */
export class CatalogueClient {
	constructor(
		private readonly baseUrl: string,
		private readonly fetchFn: typeof fetch = fetch,
	) {}

	private async getJson<T>(path: string): Promise<T> {
		const res = await this.fetchFn(new URL(path, this.baseUrl), {
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		})
		if (!res.ok) {
			// 4xx means fix the arguments, 5xx means come back later.
			const detail = await res
				.json()
				.then((body) => (body as { error?: string } | null)?.error)
				.catch(() => undefined)
			throw new Error(
				`GET ${path} failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`,
			)
		}
		return (await res.json()) as T
	}

	async getEmotions(): Promise<Emotion[]> {
		const emotions = await this.getJson<Emotion[]>("/api/catalogue/emotions")
		// An older deployment may still return internal columns.
		return emotions.map(({ id, emoji, name }) => ({ id, emoji, name }))
	}

	async searchReviews(args: SearchReviewsArgs): Promise<ReviewSearchResult> {
		// Emotions are needed both to resolve the filter and to name the results,
		// so fetch them once up front.
		const emotions = await this.getEmotions()

		let emotionId: number | undefined
		if (args.emotion) {
			emotionId = resolveEmotionId(args.emotion, emotions)
			if (emotionId === undefined)
				throw new Error(
					`Unknown emotion "${args.emotion}". Available: ${emotions
						.map((e) => e.name)
						.join(", ")}.`,
				)
		}

		// The API applies every filter (date included) and caps a page at 100.
		const limit = clampCount(args.limit, DEFAULT_SEARCH_LIMIT, 1)
		const offset = clampCount(args.offset, 0, 0)
		const raw: ApiReview[] = []
		let hasMore = false
		let page = 0
		for (; page < MAX_PAGES; page++) {
			const params = buildReviewSearchParams(
				args,
				emotionId,
				Math.min(PAGE_SIZE, limit - raw.length),
				offset + raw.length,
			)
			const res = await this.getJson<{
				reviews: ApiReview[]
				hasMore: boolean
			}>(`/api/catalogue/reviews?${params}`)
			raw.push(...res.reviews)
			hasMore = res.hasMore
			// An empty page can't advance the offset, so reporting more would send
			// the caller round in circles.
			if (res.reviews.length === 0) {
				hasMore = false
				break
			}
			if (raw.length >= limit || !res.hasMore) break
		}
		// A server that never reports the end would otherwise be indistinguishable
		// from a complete result.
		if (page === MAX_PAGES)
			throw new Error(
				`Gave up after ${MAX_PAGES} pages (${raw.length} reviews) without reaching the end of the results.`,
			)

		const emotionsById = new Map(emotions.map((e) => [e.id, e]))
		const reviews = raw
			.slice(0, limit)
			.map((r) => enrichReview(r, emotionsById))
		return {
			offset,
			returned: reviews.length,
			limit,
			hasMore: hasMore || raw.length > reviews.length,
			reviews,
		}
	}

	async listTodoLists(): Promise<TodoListSummary[]> {
		// Entries dwarf the summaries: ask the API to omit them, and drop any
		// it still sends.
		const { lists } = await this.getJson<{
			lists: (TodoListSummary & { items?: TodoItem[] })[]
		}>("/api/catalogue/todo?items=false")
		return lists.map(({ items: _items, ...summary }) => summary)
	}

	async getTodoList(
		id: string,
		filter: {
			status?: TodoStatus
			query?: string
			limit?: number
			offset?: number
		} = {},
	): Promise<TodoListView> {
		// Ask for just this list: the others run to hundreds of kilobytes.
		const { lists } = await this.getJson<{ lists: TodoListDetail[] }>(
			`/api/catalogue/todo?list=${encodeURIComponent(id)}`,
		)
		// An older deployment ignored the param, so match locally. Normalise both
		// sides as the server does, else an honored response would be rejected.
		const normalise = (s: string) => s.trim().toLowerCase().normalize("NFC")
		const wanted = normalise(id)
		const list = lists.find(
			(l) => normalise(l.id) === wanted || normalise(l.title) === wanted,
		)
		if (!list)
			throw new Error(
				`Unknown to-do list "${id}". Available: ${lists.map((l) => l.id).join(", ")}.`,
			)

		const status = filter.status ?? "all"
		const query = (filter.query ?? "").trim().toLowerCase()
		const matching = list.items.filter((item) => {
			if (status === "done" && !item.done) return false
			if (status === "todo" && item.done) return false
			// Search title and metadata together, as the website's filter does.
			if (query) {
				const haystack = `${item.name} ${item.meta ?? ""}`.toLowerCase()
				if (!haystack.includes(query)) return false
			}
			return true
		})

		const limit = clampCount(filter.limit, DEFAULT_TODO_LIMIT, 1)
		const offset = clampCount(filter.offset, 0, 0)
		const { items: _items, ...summary } = list
		return {
			...summary,
			offset,
			matched: matching.length,
			items: matching
				.slice(offset, offset + limit)
				.map(({ poster: _poster, ...item }) => item),
		}
	}
}
