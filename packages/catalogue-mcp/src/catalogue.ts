/**
 * Data layer for the catalogue MCP server: a thin, read-only HTTP client over
 * the public goulven-clech.dev API, plus the pure mapping/filtering helpers the
 * tools are built from. Deliberately free of any MCP SDK import so it stays
 * unit-testable on its own.
 *
 * A couple of small tables (media types, rating labels) are mirrored from the
 * website rather than imported, so this package can be published and run
 * standalone without depending on the Astro app's source.
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
	id: string
	source: string
	source_id: string
	source_name: string
	source_link: string
	source_img: string
	source_img_focus_y: number | null
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
	id: string
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
}

/** MAX_LIMIT of the reviews API; we page at this size. */
const PAGE_SIZE = 100
/** Backstop against a misbehaving hasMore, ~5000 reviews. */
const MAX_PAGES = 50

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
		const res = await this.fetchFn(new URL(path, this.baseUrl))
		if (!res.ok)
			throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`)
		return (await res.json()) as T
	}

	async getEmotions(): Promise<Emotion[]> {
		const emotions = await this.getJson<Emotion[]>("/api/catalogue/emotions")
		// Project to the fields we expose, dropping the DB's is_deleted flag.
		return emotions.map(({ id, emoji, name }) => ({ id, emoji, name }))
	}

	async searchReviews(args: SearchReviewsArgs): Promise<Review[]> {
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

		// The API applies every filter (date included) and caps a page at 100; page
		// until it reports no more, or until we already have enough for `limit`.
		const raw: ApiReview[] = []
		let page = 0
		for (; page < MAX_PAGES; page++) {
			const params = buildReviewSearchParams(
				args,
				emotionId,
				PAGE_SIZE,
				page * PAGE_SIZE,
			)
			const res = await this.getJson<{
				reviews: ApiReview[]
				hasMore: boolean
			}>(`/api/catalogue/reviews?${params}`)
			raw.push(...res.reviews)
			if (args.limit !== undefined && raw.length >= args.limit) break
			if (!res.hasMore) break
		}
		// Fail loudly rather than silently truncate if a query ever matches more
		// than the page backstop allows (raise MAX_PAGES, or narrow the search).
		if (page === MAX_PAGES)
			throw new Error(
				`Too many matching reviews to page through (over ${MAX_PAGES * PAGE_SIZE}). Narrow the search with more filters.`,
			)

		const emotionsById = new Map(emotions.map((e) => [e.id, e]))
		const enriched = raw.map((r) => enrichReview(r, emotionsById))
		return args.limit !== undefined ? enriched.slice(0, args.limit) : enriched
	}

	async listTodoLists(): Promise<TodoListSummary[]> {
		const { lists } = await this.getJson<{ lists: TodoListDetail[] }>(
			"/api/catalogue/todo.json",
		)
		return lists.map(({ items: _items, ...summary }) => summary)
	}

	async getTodoList(
		id: string,
		filter: { status?: TodoStatus; query?: string } = {},
	): Promise<TodoListDetail> {
		const { lists } = await this.getJson<{ lists: TodoListDetail[] }>(
			"/api/catalogue/todo.json",
		)
		const list = lists.find(
			(l) => l.id === id || l.title.toLowerCase() === id.toLowerCase(),
		)
		if (!list)
			throw new Error(
				`Unknown to-do list "${id}". Available: ${lists.map((l) => l.id).join(", ")}.`,
			)

		const status = filter.status ?? "all"
		const query = (filter.query ?? "").trim().toLowerCase()
		const items = list.items.filter((item) => {
			if (status === "done" && !item.done) return false
			if (status === "todo" && item.done) return false
			if (query && !item.name.toLowerCase().includes(query)) return false
			return true
		})
		return { ...list, items }
	}
}
