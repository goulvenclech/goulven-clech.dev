import { describe, it, expect, vi } from "vitest"
import type { TodoList } from "../../src/catalogue/todo"
import {
	createEndpointContext,
	createMockDbClient,
	parseJsonResponse,
} from "../helpers"

import { GET } from "../../src/pages/api/catalogue/todo"

const lists: TodoList[] = [
	{
		id: "movies",
		title: "Movies to watch",
		description: "A few films",
		source: "TMDB_MOVIE",
		url: "https://example.com",
		entries: [
			{
				id: 603,
				name: "The Matrix",
				year: 1999,
				poster: null,
				link: "https://m/603",
			},
			{
				id: 604,
				name: "The Matrix Reloaded",
				year: 2003,
				poster: null,
				link: "https://m/604",
			},
		],
	},
]

interface TodoResponse {
	lists: {
		id: string
		title: string
		source: string
		url: string | null
		progress: { total: number; doneCount: number; percent: number }
		items: { id: number | string; done: boolean; emoji: string | null }[]
	}[]
}

describe("GET /api/catalogue/todo", () => {
	it("returns lists with completion computed from reviews", async () => {
		// One of the two entries has a matching review → marked done.
		const client = createMockDbClient({
			"FROM reviews": [{ source_id: 603, rating: 5 }],
		})
		const res = await GET(
			createEndpointContext("/api/catalogue/todo"),
			client,
			lists,
		)
		expect(res.status).toBe(200)

		const data = await parseJsonResponse<TodoResponse>(res)
		const list = data.lists[0]
		expect(list.progress).toEqual({ total: 2, doneCount: 1, percent: 50 })
		expect(list.items.find((i) => i.id === 603)?.done).toBe(true)
		expect(list.items.find((i) => i.id === 603)?.emoji).toBe("😍")
		expect(list.items.find((i) => i.id === 604)?.done).toBe(false)
	})

	it("degrades to nothing-done (still 200) when the reviews query fails", async () => {
		const client = {
			execute: async () => {
				throw new Error("db down")
			},
		} as unknown as Parameters<typeof GET>[1]
		const res = await GET(
			createEndpointContext("/api/catalogue/todo"),
			client,
			lists,
		)
		expect(res.status).toBe(200)

		const data = await parseJsonResponse<TodoResponse>(res)
		expect(data.lists[0].progress.doneCount).toBe(0)
		expect(data.lists[0].items.every((i) => !i.done)).toBe(true)
	})

	it("serves a BCE year as the raw negative number, not as display text", async () => {
		const ancient: TodoList[] = [
			{
				...lists[0],
				source: "OPENLIBRARY",
				entries: [
					{
						id: "OL22159894M",
						name: "La République",
						year: -375,
						poster: null,
						link: "https://openlibrary.org/books/OL22159894M",
					},
				],
			},
		]
		const client = createMockDbClient({ "FROM reviews": [] })
		const res = await GET(
			createEndpointContext("/api/catalogue/todo"),
			client,
			ancient,
		)

		const data = await parseJsonResponse<{
			lists: { items: { year: number | null }[] }[]
		}>(res)
		expect(data.lists[0].items[0].year).toBe(-375)
	})

	it("caches the response for an hour", async () => {
		const client = createMockDbClient({ "FROM reviews": [] })
		const res = await GET(
			createEndpointContext("/api/catalogue/todo"),
			client,
			lists,
		)
		expect(res.headers.get("Cache-Control")).toContain("max-age=3600")
	})

	it("omits the entries when asked for a summary", async () => {
		const client = createMockDbClient({ "FROM reviews": [] })
		const res = await GET(
			createEndpointContext("/api/catalogue/todo?items=false"),
			client,
			lists,
		)

		const data = await parseJsonResponse<{
			lists: { progress: unknown; items?: unknown }[]
		}>(res)
		expect(data.lists[0].items).toBeUndefined()
		expect(data.lists[0].progress).toEqual({
			total: 2,
			doneCount: 0,
			percent: 0,
		})
	})

	it("returns only the requested list", async () => {
		const twoLists: TodoList[] = [
			...lists,
			{ ...lists[0], id: "games", title: "Games to play", source: "IGDB" },
		]
		const client = createMockDbClient({ "FROM reviews": [] })
		const res = await GET(
			createEndpointContext("/api/catalogue/todo?list=games"),
			client,
			twoLists,
		)

		const data = await parseJsonResponse<TodoResponse>(res)
		expect(data.lists.map((l) => l.id)).toEqual(["games"])
	})

	it("queries only the selected list's source", async () => {
		const twoLists: TodoList[] = [
			...lists,
			{ ...lists[0], id: "games", title: "Games to play", source: "IGDB" },
		]
		const client = createMockDbClient({ "FROM reviews": [] })
		await GET(
			createEndpointContext("/api/catalogue/todo?list=games"),
			client,
			twoLists,
		)

		const sources = vi
			.mocked(client.execute)
			.mock.calls.map(
				(call) =>
					call[0] as unknown as string | { sql: string; args?: unknown[] },
			)
			.filter(
				(stmt) => typeof stmt !== "string" && stmt.sql.includes("FROM reviews"),
			)
			.map((stmt) => (stmt as { args?: unknown[] }).args?.[0])
		expect(sources).toEqual(["IGDB"])
	})

	it("refuses an empty list selector rather than returning everything", async () => {
		const client = createMockDbClient({ "FROM reviews": [] })
		const res = await GET(
			createEndpointContext("/api/catalogue/todo?list="),
			client,
			lists,
		)
		expect(res.status).toBe(404)
	})

	it("tolerates surrounding whitespace and casing in the selector", async () => {
		const client = createMockDbClient({ "FROM reviews": [] })
		const res = await GET(
			createEndpointContext("/api/catalogue/todo?list=%20MOVIES%20"),
			client,
			lists,
		)

		const data = await parseJsonResponse<TodoResponse>(res)
		expect(data.lists.map((l) => l.id)).toEqual(["movies"])
	})

	it("accepts a list title as well as its id", async () => {
		const client = createMockDbClient({ "FROM reviews": [] })
		const res = await GET(
			createEndpointContext("/api/catalogue/todo?list=movies%20to%20watch"),
			client,
			lists,
		)

		const data = await parseJsonResponse<TodoResponse>(res)
		expect(data.lists.map((l) => l.id)).toEqual(["movies"])
	})

	it("refuses an unknown list and names the ones that exist", async () => {
		const client = createMockDbClient({ "FROM reviews": [] })
		const res = await GET(
			createEndpointContext("/api/catalogue/todo?list=nope"),
			client,
			lists,
		)
		expect(res.status).toBe(404)

		const data = await parseJsonResponse<{ error: string }>(res)
		expect(data.error).toContain('Unknown to-do list "nope"')
		expect(data.error).toContain("movies")
	})

	it("keeps the most recent review when an entry was reviewed twice", async () => {
		const client = createMockDbClient({
			"FROM reviews": [
				{ source_id: 603, rating: 5 },
				{ source_id: 603, rating: 1 },
			],
		})
		const res = await GET(
			createEndpointContext("/api/catalogue/todo"),
			client,
			lists,
		)

		const data = await parseJsonResponse<TodoResponse>(res)
		expect(data.lists[0].items.find((i) => i.id === 603)?.emoji).toBe("😍")

		// First-row-wins is only "most recent" because the query orders by date.
		const reviewsSql = vi
			.mocked(client.execute)
			.mock.calls.map((call) => {
				const stmt = call[0] as unknown as string | { sql: string }
				return typeof stmt === "string" ? stmt : stmt.sql
			})
			.find((sql) => sql.includes("FROM reviews"))
		expect(reviewsSql).toContain("ORDER BY inserted_at DESC")
	})

	it("does not let a review from one source mark another source's entry", async () => {
		const twoLists: TodoList[] = [
			...lists,
			{
				id: "games",
				title: "Games to play",
				description: "A few games",
				source: "IGDB",
				entries: [
					{
						id: 603,
						name: "Hollow Knight",
						year: 2017,
						poster: null,
						link: "",
					},
				],
			},
		]
		const client = createMockDbClient({
			"FROM reviews": ([source]) =>
				source === "IGDB" ? [{ source_id: 603, rating: 6 }] : [],
		})

		const res = await GET(
			createEndpointContext("/api/catalogue/todo"),
			client,
			twoLists,
		)

		const data = await parseJsonResponse<TodoResponse>(res)
		const movies = data.lists.find((l) => l.source === "TMDB_MOVIE")
		const games = data.lists.find((l) => l.source === "IGDB")
		expect(games?.items[0].done).toBe(true)
		expect(movies?.items.every((i) => !i.done)).toBe(true)
	})
})
