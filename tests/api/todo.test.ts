import { describe, it, expect, vi } from "vitest"
import type { TodoList } from "../../src/catalogueTodo"
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

	it("caches the response for an hour", async () => {
		const client = createMockDbClient({ "FROM reviews": [] })
		const res = await GET(
			createEndpointContext("/api/catalogue/todo"),
			client,
			lists,
		)
		expect(res.headers.get("Cache-Control")).toContain("max-age=3600")
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
