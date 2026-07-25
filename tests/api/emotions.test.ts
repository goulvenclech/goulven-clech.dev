import { describe, it, expect, vi } from "vitest"
import type { Client } from "@libsql/client"
import {
	createEndpointContext,
	createMockDbClient,
	parseJsonResponse,
} from "../helpers"

import { GET, type Emotion } from "../../src/pages/api/catalogue/emotions"

const rows = [
	{ id: 1, emoji: "🤗", name: "comforted" },
	{ id: 2, emoji: "🌿", name: "nostalgic" },
]

describe("GET /api/catalogue/emotions", () => {
	it("returns the emotions the catalogue offers", async () => {
		const client = createMockDbClient({ "FROM emotions": rows })
		const res = await GET(
			createEndpointContext("/api/catalogue/emotions"),
			client,
		)
		expect(res.status).toBe(200)

		const data = await parseJsonResponse<Emotion[]>(res)
		expect(data).toEqual(rows)
	})

	it("exposes only id, emoji and name, whatever the row carries", async () => {
		const client = createMockDbClient({
			"FROM emotions": [{ ...rows[0], is_deleted: 0, internal_note: "hidden" }],
		})
		const res = await GET(
			createEndpointContext("/api/catalogue/emotions"),
			client,
		)

		const data = await parseJsonResponse<Emotion[]>(res)
		expect(data).toEqual([rows[0]])
	})

	it("leaves deleted emotions to the database", async () => {
		const client = createMockDbClient({ "FROM emotions": rows })
		await GET(createEndpointContext("/api/catalogue/emotions"), client)

		const sql = vi.mocked(client.execute).mock.calls[0][0] as unknown as string
		expect(sql).toContain("is_deleted = false")
	})

	it("caches without pinning a stale list", async () => {
		const client = createMockDbClient({ "FROM emotions": rows })
		const res = await GET(
			createEndpointContext("/api/catalogue/emotions"),
			client,
		)

		const cacheControl = res.headers.get("Cache-Control")
		expect(cacheControl).toContain("stale-while-revalidate")
		expect(cacheControl).not.toContain("immutable")
	})

	it("returns 500 when the query fails", async () => {
		const client = {
			execute: async () => {
				throw new Error("db down")
			},
		} as unknown as Client
		const res = await GET(
			createEndpointContext("/api/catalogue/emotions"),
			client,
		)
		expect(res.status).toBe(500)
	})
})
