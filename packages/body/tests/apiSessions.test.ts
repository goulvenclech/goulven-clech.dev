import { readFileSync } from "node:fs"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createClient } from "@libsql/client"
import type { APIContext } from "astro"
// Resolved to tests/__mocks__/astro-env.ts by the vitest alias, so the
// password used here always matches what the handler checks against.
import { BODY_PASSWORD } from "astro:env/server"
import { GET, POST } from "$src/pages/api/sessions"

// Shared-cache in-memory SQLite: lives as long as this client stays open,
// visible to the transactions the handler opens on the same client.
const client = createClient({ url: "file::memory:?cache=shared" })

const getContext = (query = "") =>
	({ url: new URL(`http://body.test/api/sessions${query}`) }) as APIContext

const postContext = (body: BodyInit) =>
	({
		request: new Request("http://body.test/api/sessions", {
			method: "POST",
			body,
		}),
	}) as APIContext

const post = (payload: Record<string, unknown>) =>
	POST(
		postContext(JSON.stringify({ password: BODY_PASSWORD, ...payload })),
		client,
	)

// Fixed past dates: 2026-08-17 is a Monday (strength), Sunday is rest.
const seed = async (dates: string[]) => {
	for (const date of dates) {
		const res = await post({
			date,
			status: "completed",
			sets: [{ exercise: "squat", weight_kg: 60, reps: 5 }],
		})
		expect(res.status).toBe(201)
	}
}

beforeAll(async () => {
	const schema = readFileSync(
		new URL("../db/schema.sql", import.meta.url),
		"utf8",
	)
	await client.executeMultiple(schema)
})

beforeEach(async () => {
	await client.executeMultiple(
		"DELETE FROM session_sets; DELETE FROM sessions;",
	)
})

describe("GET /api/sessions", () => {
	it("returns an empty page on an empty database", async () => {
		const res = await GET(getContext(), client)
		expect(res.status).toBe(200)
		expect(await res.json()).toEqual({ sessions: [], hasMore: false })
	})

	it("paginates most recent first and reports hasMore", async () => {
		await seed(["2026-08-14", "2026-08-17", "2026-08-18"])

		const first = await (await GET(getContext("?limit=2"), client)).json()
		expect(first.sessions.map((s: { date: string }) => s.date)).toEqual([
			"2026-08-18",
			"2026-08-17",
		])
		expect(first.hasMore).toBe(true)

		const last = await (
			await GET(getContext("?limit=2&offset=2"), client)
		).json()
		expect(last.sessions.map((s: { date: string }) => s.date)).toEqual([
			"2026-08-14",
		])
		expect(last.hasMore).toBe(false)
	})

	it("falls back to defaults on out-of-range limit and offset", async () => {
		await seed(["2026-08-17", "2026-08-18"])
		for (const query of ["?limit=0", "?limit=101", "?limit=abc&offset=-1"]) {
			const body = await (await GET(getContext(query), client)).json()
			expect(body.sessions).toHaveLength(2)
			expect(body.hasMore).toBe(false)
		}
	})

	it("attaches each session's sets", async () => {
		const res = await post({
			date: "2026-08-17",
			status: "completed",
			sets: [
				{ exercise: "squat", weight_kg: 60, reps: 5 },
				{ exercise: "pull-up", reps: 8 },
			],
		})
		expect(res.status).toBe(201)

		const body = await (await GET(getContext(), client)).json()
		expect(body.sessions[0].sets).toEqual([
			{
				exercise: "squat",
				pattern: "squat",
				weight_kg: 60,
				reps: 5,
				set_index: 1,
			},
			{
				exercise: "pull-up",
				pattern: "pull",
				weight_kg: null,
				reps: 8,
				set_index: 2,
			},
		])
	})
})

describe("POST /api/sessions", () => {
	it("rejects a wrong password before validating anything", async () => {
		const res = await POST(
			postContext(JSON.stringify({ password: "wrong", date: "not-a-date" })),
			client,
		)
		expect(res.status).toBe(401)
	})

	it("rejects a malformed JSON body with 400", async () => {
		const res = await POST(postContext("not json"), client)
		expect(res.status).toBe(400)
	})

	it("rejects an invalid payload with 400 once authenticated", async () => {
		const res = await post({ date: "not-a-date", status: "completed" })
		expect(res.status).toBe(400)
		expect((await res.json()).error).toBe("Invalid date")
	})

	it("logs a valid session and returns its id", async () => {
		const res = await post({
			date: "2026-08-17",
			status: "completed",
			sets: [{ exercise: "bench-press", weight_kg: 40, reps: 8 }],
		})
		expect(res.status).toBe(201)
		const body = await res.json()
		expect(body.ok).toBe(true)
		expect(typeof body.id).toBe("number")
	})

	it("refuses a second session on the same date with 409", async () => {
		await seed(["2026-08-17"])
		const res = await post({ date: "2026-08-17", status: "completed" })
		expect(res.status).toBe(409)
	})
})
