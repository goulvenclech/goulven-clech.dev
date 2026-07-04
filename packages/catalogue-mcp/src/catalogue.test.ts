import { describe, it, expect, vi } from "vitest"
import {
	buildReviewSearchParams,
	resolveEmotionId,
	enrichReview,
	CatalogueClient,
	type ApiReview,
	type Emotion,
	type TodoListDetail,
} from "./catalogue.js"

const emotions: Emotion[] = [
	{ id: 1, emoji: "😌", name: "Nostalgia" },
	{ id: 2, emoji: "😢", name: "Sadness" },
]

function apiReview(overrides: Partial<ApiReview> = {}): ApiReview {
	return {
		id: "r1",
		source: "TMDB_MOVIE",
		source_id: "603",
		source_name: "The Matrix",
		source_link: "https://themoviedb.org/movie/603",
		source_img: "https://img/matrix.jpg",
		source_img_focus_y: 0.5,
		rating: 5,
		emotions: [1],
		comment: "Woah.",
		inserted_at: "2023-06-15T10:00:00.000Z",
		meta: '{"director":"The Wachowskis"}',
		...overrides,
	}
}

describe("buildReviewSearchParams", () => {
	it("maps a friendly type to its source and always sets limit/offset", () => {
		const params = buildReviewSearchParams(
			{ type: "movie" },
			undefined,
			100,
			200,
		)
		expect(params.get("source")).toBe("TMDB_MOVIE")
		expect(params.get("limit")).toBe("100")
		expect(params.get("offset")).toBe("200")
	})

	it("passes query, rating, resolved emotion id and sort through", () => {
		const params = buildReviewSearchParams(
			{ query: "matrix", rating: 5, sort: "rating" },
			1,
			100,
			0,
		)
		expect(params.get("query")).toBe("matrix")
		expect(params.get("rating")).toBe("5")
		expect(params.get("emotion")).toBe("1")
		expect(params.get("sort")).toBe("rating")
	})

	it("omits filters that were not provided", () => {
		const params = buildReviewSearchParams({}, undefined, 100, 0)
		expect(params.has("source")).toBe(false)
		expect(params.has("rating")).toBe(false)
		expect(params.has("emotion")).toBe(false)
	})

	it("passes date filters straight through to the API", () => {
		const params = buildReviewSearchParams(
			{ year: 2023, after: "2023-06-01", before: "2023-12-31" },
			undefined,
			100,
			0,
		)
		expect(params.get("year")).toBe("2023")
		expect(params.get("after")).toBe("2023-06-01")
		expect(params.get("before")).toBe("2023-12-31")
	})
})

describe("resolveEmotionId", () => {
	it("matches an emotion name case-insensitively", () => {
		expect(resolveEmotionId("nostalgia", emotions)).toBe(1)
		expect(resolveEmotionId("  SADNESS ", emotions)).toBe(2)
	})

	it("returns undefined for an unknown name", () => {
		expect(resolveEmotionId("joy", emotions)).toBeUndefined()
	})
})

describe("enrichReview", () => {
	const byId = new Map(emotions.map((e) => [e.id, e]))

	it("resolves emotion ids to names, parses meta, and adds a rating label", () => {
		const enriched = enrichReview(apiReview(), byId)
		expect(enriched.type).toBe("movie")
		expect(enriched.title).toBe("The Matrix")
		expect(enriched.rating_label).toBe("😍 loved")
		expect(enriched.emotions).toEqual([
			{ id: 1, name: "Nostalgia", emoji: "😌" },
		])
		expect(enriched.meta).toEqual({ director: "The Wachowskis" })
		expect(enriched).not.toHaveProperty("source_img_focus_y")
	})

	it("falls back gracefully on unknown emotion ids and unparseable meta", () => {
		const enriched = enrichReview(
			apiReview({ emotions: [99], meta: "not json" }),
			byId,
		)
		expect(enriched.emotions).toEqual([{ id: 99, name: "#99", emoji: "" }])
		expect(enriched.meta).toBe("not json")
	})
})

/** A fetch stub that routes by pathname to canned JSON. */
function stubFetch(routes: Record<string, unknown | (() => unknown)>) {
	return vi.fn(async (input: URL | string) => {
		const url = new URL(input.toString(), "http://x")
		const route = routes[url.pathname]
		const body =
			typeof route === "function" ? (route as () => unknown)() : route
		return {
			ok: body !== undefined,
			status: body === undefined ? 404 : 200,
			statusText: body === undefined ? "Not Found" : "OK",
			json: async () => body,
		} as Response
	})
}

describe("CatalogueClient.searchReviews", () => {
	it("walks every page the API reports and enriches the results", async () => {
		let call = 0
		const fetchFn = stubFetch({
			"/api/catalogue/emotions": emotions,
			"/api/catalogue/reviews": () => {
				// Two pages: the first reports more, the second ends it.
				call++
				return call === 1
					? {
							reviews: [apiReview({ id: "a" }), apiReview({ id: "b" })],
							hasMore: true,
						}
					: { reviews: [apiReview({ id: "c" })], hasMore: false }
			},
		})
		const client = new CatalogueClient(
			"http://x",
			fetchFn as unknown as typeof fetch,
		)

		const reviews = await client.searchReviews({})
		expect(reviews.map((r) => r.id)).toEqual(["a", "b", "c"])
		expect(reviews[0].emotions[0].name).toBe("Nostalgia")
	})

	it("throws a helpful error for an unknown emotion, without paging reviews", async () => {
		const reviewsRoute = vi.fn(() => ({ reviews: [], hasMore: false }))
		const fetchFn = stubFetch({
			"/api/catalogue/emotions": emotions,
			"/api/catalogue/reviews": reviewsRoute,
		})
		const client = new CatalogueClient(
			"http://x",
			fetchFn as unknown as typeof fetch,
		)

		await expect(client.searchReviews({ emotion: "joy" })).rejects.toThrow(
			/Unknown emotion "joy"/,
		)
		expect(reviewsRoute).not.toHaveBeenCalled()
	})

	it("forwards date filters to the API rather than filtering locally", async () => {
		const fetchFn = stubFetch({
			"/api/catalogue/emotions": emotions,
			"/api/catalogue/reviews": { reviews: [apiReview()], hasMore: false },
		})
		const client = new CatalogueClient(
			"http://x",
			fetchFn as unknown as typeof fetch,
		)

		await client.searchReviews({ year: 2023, after: "2023-06-01" })

		const reviewUrl = fetchFn.mock.calls
			.map((c) => new URL(String(c[0]), "http://x"))
			.find((u) => u.pathname === "/api/catalogue/reviews")
		expect(reviewUrl?.searchParams.get("year")).toBe("2023")
		expect(reviewUrl?.searchParams.get("after")).toBe("2023-06-01")
	})

	it("stops paging once limit is met when no date filter is set", async () => {
		const reviewsRoute = vi.fn(() => ({
			reviews: [apiReview({ id: "a" }), apiReview({ id: "b" })],
			hasMore: true,
		}))
		const fetchFn = stubFetch({
			"/api/catalogue/emotions": emotions,
			"/api/catalogue/reviews": reviewsRoute,
		})
		const client = new CatalogueClient(
			"http://x",
			fetchFn as unknown as typeof fetch,
		)

		const reviews = await client.searchReviews({ limit: 1 })
		expect(reviews).toHaveLength(1)
		expect(reviewsRoute).toHaveBeenCalledTimes(1) // did not chase hasMore
	})

	it("fails loudly instead of truncating when the page backstop is hit", async () => {
		const fetchFn = stubFetch({
			"/api/catalogue/emotions": emotions,
			"/api/catalogue/reviews": { reviews: [apiReview()], hasMore: true },
		})
		const client = new CatalogueClient(
			"http://x",
			fetchFn as unknown as typeof fetch,
		)

		await expect(client.searchReviews({})).rejects.toThrow(/Too many/)
	})
})

describe("CatalogueClient.getTodoList", () => {
	const detail: TodoListDetail = {
		id: "movies-to-watch",
		title: "Movies to watch",
		description: "…",
		source: "TMDB_MOVIE",
		url: null,
		progress: { total: 2, doneCount: 1, percent: 50 },
		items: [
			{
				id: 1,
				name: "Alien",
				year: 1979,
				poster: null,
				done: true,
				emoji: "😍",
				href: "/x",
			},
			{
				id: 2,
				name: "Aliens",
				year: 1986,
				poster: null,
				done: false,
				emoji: null,
				href: "/y",
			},
		],
	}

	it("filters entries by status", async () => {
		const fetchFn = stubFetch({
			"/api/catalogue/todo.json": { lists: [detail] },
		})
		const client = new CatalogueClient(
			"http://x",
			fetchFn as unknown as typeof fetch,
		)

		const todo = await client.getTodoList("movies-to-watch", { status: "todo" })
		expect(todo.items.map((i) => i.name)).toEqual(["Aliens"])
	})

	it("resolves a list by title and rejects an unknown id", async () => {
		const fetchFn = stubFetch({
			"/api/catalogue/todo.json": { lists: [detail] },
		})
		const client = new CatalogueClient(
			"http://x",
			fetchFn as unknown as typeof fetch,
		)

		expect((await client.getTodoList("Movies to watch")).id).toBe(
			"movies-to-watch",
		)
		await expect(client.getTodoList("nope")).rejects.toThrow(
			/Unknown to-do list/,
		)
	})
})
