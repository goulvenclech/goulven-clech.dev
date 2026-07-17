import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Client } from "@libsql/client"
import {
	createEndpointContext,
	createMockDbClient,
	parseJsonResponse,
	sampleReview,
} from "../helpers"

// Only IGDB is wired; an absent key drives the "unsupported source" path.
vi.mock("../../src/pages/api/catalogue/sourceResolver", () => ({
	sourceResolvers: { IGDB: vi.fn() },
}))
vi.stubEnv("CATALOGUE_PASSWORD", "secret")

import { GET, POST } from "../../src/pages/api/catalogue/reviews"
import { sourceResolvers } from "../../src/pages/api/catalogue/sourceResolver"

// The DB stores emotions as a JSON string; the handler parses it back.
const dbRow = {
	...sampleReview,
	emotions: JSON.stringify(sampleReview.emotions),
}

beforeEach(() => {
	vi.clearAllMocks()
})

describe("GET /api/catalogue/reviews", () => {
	it("returns reviews and parses the emotions JSON into a number[]", async () => {
		const client = createMockDbClient({ "FROM reviews": [dbRow] })
		const res = await GET(
			createEndpointContext("/api/catalogue/reviews"),
			client,
		)
		expect(res.status).toBe(200)

		const data = await parseJsonResponse<{
			reviews: { emotions: number[] }[]
			hasMore: boolean
		}>(res)
		expect(data.reviews).toHaveLength(1)
		expect(data.reviews[0].emotions).toEqual([1, 3])
	})

	it("defaults emotions to [] when the stored value is null", async () => {
		const client = createMockDbClient({
			"FROM reviews": [{ ...dbRow, emotions: null }],
		})
		const res = await GET(
			createEndpointContext("/api/catalogue/reviews"),
			client,
		)
		const data = await parseJsonResponse<{ reviews: { emotions: number[] }[] }>(
			res,
		)
		expect(data.reviews[0].emotions).toEqual([])
	})

	it("sets hasMore and slices back to the limit when extra rows exist", async () => {
		// Default limit is 5, so the handler fetches 6 to detect a next page.
		const client = createMockDbClient({
			"FROM reviews": Array.from({ length: 6 }, () => ({ ...dbRow })),
		})
		const res = await GET(
			createEndpointContext("/api/catalogue/reviews"),
			client,
		)
		const data = await parseJsonResponse<{
			reviews: unknown[]
			hasMore: boolean
		}>(res)
		expect(data.hasMore).toBe(true)
		expect(data.reviews).toHaveLength(5)
	})

	it("reports hasMore=false when rows do not exceed the limit", async () => {
		const client = createMockDbClient({
			"FROM reviews": Array.from({ length: 3 }, () => ({ ...dbRow })),
		})
		const res = await GET(
			createEndpointContext("/api/catalogue/reviews"),
			client,
		)
		const data = await parseJsonResponse<{
			reviews: unknown[]
			hasMore: boolean
		}>(res)
		expect(data.hasMore).toBe(false)
		expect(data.reviews).toHaveLength(3)
	})

	it("caches the response for 60 seconds", async () => {
		const client = createMockDbClient({ "FROM reviews": [dbRow] })
		const res = await GET(
			createEndpointContext("/api/catalogue/reviews"),
			client,
		)
		expect(res.headers.get("Cache-Control")).toContain("max-age=60")
	})

	it("returns 500 when the query fails", async () => {
		const client = {
			execute: vi.fn().mockRejectedValue(new Error("db down")),
		} as unknown as Client
		const res = await GET(
			createEndpointContext("/api/catalogue/reviews"),
			client,
		)
		expect(res.status).toBe(500)
	})

	async function runQuery(qs: string) {
		const client = createMockDbClient({ "FROM reviews": [dbRow] })
		await GET(createEndpointContext(`/api/catalogue/reviews${qs}`), client)
		return vi.mocked(client.execute).mock.calls[0][0] as unknown as {
			sql: string
			args: unknown[]
		}
	}

	it.each([
		{ name: "non-numeric rating", qs: "?rating=abc", clause: "rating = ?" },
		{
			name: "non-numeric emotion",
			qs: "?emotion=abc",
			clause: "json_each(reviews.emotions)",
		},
		{ name: "unknown source", qs: "?source=BOGUS", clause: "source = ?" },
	])(
		"ignores an invalid $name instead of filtering on it",
		async ({ qs, clause }) => {
			const stmt = await runQuery(qs)
			expect(stmt.sql).not.toContain(clause)
			expect(
				stmt.args.some((a) => typeof a === "number" && Number.isNaN(a)),
			).toBe(false)
		},
	)

	it("keeps valid filters and never lets NaN reach the query args", async () => {
		const stmt = await runQuery("?rating=4&emotion=2&source=IGDB")
		expect(stmt.sql).toContain("rating = ?")
		expect(stmt.sql).toContain("json_each(reviews.emotions)")
		expect(stmt.sql).toContain("source = ?")
		expect(stmt.args).toContain(4)
		expect(stmt.args).toContain(2)
		expect(stmt.args).toContain("IGDB")
	})
})

describe("POST /api/catalogue/reviews", () => {
	const validBody = {
		password: "secret",
		source: "IGDB",
		source_id: "1",
		rating: 5,
		emotions: [1],
		comment: "loved it",
	}

	function postCtx(body: unknown) {
		return createEndpointContext("/api/catalogue/reviews", {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		})
	}

	it("rejects a wrong password with 401 and writes nothing", async () => {
		const client = createMockDbClient()
		const res = await POST(postCtx({ ...validBody, password: "nope" }), client)
		expect(res.status).toBe(401)
		expect(vi.mocked(client.execute)).not.toHaveBeenCalled()
	})

	it.each([
		{ name: "missing source_id", body: { source_id: "" } },
		{ name: "whitespace-only source_id", body: { source_id: "  " } },
		{ name: "rating below 1", body: { rating: 0 } },
		{ name: "rating above 6", body: { rating: 7 } },
		{ name: "non-integer rating", body: { rating: 3.5 } },
		{ name: "no emotions", body: { emotions: [] } },
		{ name: "too many emotions", body: { emotions: [1, 2, 3, 4] } },
	])("rejects invalid input ($name) with 400", async ({ body }) => {
		const client = createMockDbClient()
		const res = await POST(postCtx({ ...validBody, ...body }), client)
		expect(res.status).toBe(400)
		expect(vi.mocked(client.execute)).not.toHaveBeenCalled()
	})

	it("rejects an unsupported source with 400 and writes nothing", async () => {
		const client = createMockDbClient()
		const res = await POST(postCtx({ ...validBody, source: "FOOBAR" }), client)
		expect(res.status).toBe(400)
		expect(vi.mocked(client.execute)).not.toHaveBeenCalled()
	})

	it("returns 404 when the resolver finds no item", async () => {
		vi.mocked(sourceResolvers.IGDB).mockResolvedValue(null)
		const client = createMockDbClient()
		const res = await POST(postCtx(validBody), client)
		expect(res.status).toBe(404)
		expect(vi.mocked(client.execute)).not.toHaveBeenCalled()
	})

	it("inserts the resolved review and returns 201", async () => {
		vi.mocked(sourceResolvers.IGDB).mockResolvedValue({
			source_name: "Hollow Knight (2017)",
			source_link: "https://www.igdb.com/games/hollow-knight",
			source_img: "https://img/cover.jpg",
			meta: "metroidvania",
		})
		const client = createMockDbClient()
		const res = await POST(
			postCtx({ ...validBody, date: "2025-01-02" }),
			client,
		)
		expect(res.status).toBe(201)

		const stmt = vi.mocked(client.execute).mock.calls[0][0] as unknown as {
			sql: string
			args: unknown[]
		}
		expect(stmt.sql).toContain("INSERT INTO reviews")
		expect(stmt.args).toEqual([
			"IGDB",
			"1",
			"Hollow Knight (2017)",
			"https://www.igdb.com/games/hollow-knight",
			"https://img/cover.jpg",
			5,
			JSON.stringify([1]),
			"loved it",
			"metroidvania",
			new Date("2025-01-02").toISOString(),
		])
	})

	it("trims a padded source_id before resolving and inserting", async () => {
		vi.mocked(sourceResolvers.IGDB).mockResolvedValue({
			source_name: "Hollow Knight (2017)",
			source_link: "https://www.igdb.com/games/hollow-knight",
			source_img: "",
			meta: "metroidvania",
		})
		const client = createMockDbClient()
		const res = await POST(
			postCtx({ ...validBody, source_id: "  1  " }),
			client,
		)
		expect(res.status).toBe(201)
		expect(vi.mocked(sourceResolvers.IGDB)).toHaveBeenCalledWith("1")

		const stmt = vi.mocked(client.execute).mock.calls[0][0] as unknown as {
			args: unknown[]
		}
		expect(stmt.args[1]).toBe("1")
	})

	it("inserts a review even when the resolved item has no image", async () => {
		vi.mocked(sourceResolvers.IGDB).mockResolvedValue({
			source_name: "No Cover Game (TBD)",
			source_link: "https://www.igdb.com/games/no-cover",
			source_img: "",
			meta: "",
		})
		const client = createMockDbClient()
		const res = await POST(postCtx(validBody), client)
		expect(res.status).toBe(201)

		const stmt = vi.mocked(client.execute).mock.calls[0][0] as unknown as {
			args: unknown[]
		}
		expect(stmt.args[4]).toBe("") // source_img
	})
})
