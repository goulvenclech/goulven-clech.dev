import { describe, it, expect, vi } from "vitest"
import type { Client } from "@libsql/client"
import {
	createEndpointContext,
	createMockDbClient,
	parseJsonResponse,
} from "../helpers"
import { GET } from "../../src/pages/api/catalogue/dates"

describe("GET /api/catalogue/dates", () => {
	it("returns the days that already have a review", async () => {
		const client = createMockDbClient({
			"FROM reviews": [{ day: "2023-05-10" }, { day: "2021-01-02" }],
		})
		const res = await GET(createEndpointContext("/api/catalogue/dates"), client)
		expect(res.status).toBe(200)

		const days = await parseJsonResponse<string[]>(res)
		expect(days).toEqual(["2023-05-10", "2021-01-02"])
	})

	it("asks the DB for distinct day substrings of inserted_at", async () => {
		const client = createMockDbClient({ "FROM reviews": [] })
		await GET(createEndpointContext("/api/catalogue/dates"), client)

		const sql = vi.mocked(client.execute).mock.calls[0][0] as unknown as string
		expect(sql).toContain("DISTINCT")
		expect(sql).toContain("substr(inserted_at, 1, 10)")
	})

	it("is not cached, so a just-saved day is visible at once", async () => {
		const client = createMockDbClient({ "FROM reviews": [] })
		const res = await GET(createEndpointContext("/api/catalogue/dates"), client)
		expect(res.headers.get("Cache-Control")).toBe("no-store")
	})

	it("returns 500 when the query fails", async () => {
		const client = {
			execute: vi.fn().mockRejectedValue(new Error("db down")),
		} as unknown as Client
		const res = await GET(createEndpointContext("/api/catalogue/dates"), client)
		expect(res.status).toBe(500)
	})
})
