// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { GET, POST } from "../../src/pages/api/body/log"
import { deriveSyncToken } from "../../src/bodyLog"
import {
	createEndpointContext,
	createMockDbClient,
	parseJsonResponse,
} from "../helpers"

vi.stubEnv("CATALOGUE_PASSWORD", "secret")
vi.stubEnv("BODY_SYNC_SECRET", "stub-sync-secret")

const TOKEN = deriveSyncToken("stub-sync-secret", "secret")

const strengthEntry = {
	id: "11111111-1111-4111-8111-111111111111",
	kind: "strength",
	schemaVersion: 1,
	date: "2026-08-17",
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg: 60,
	reps: 5,
	rir: 2,
	unit: "reps",
}

describe("GET /api/body/log", () => {
	it("pages entries from the cursor and reports the next one", async () => {
		const client = createMockDbClient({
			"SELECT rowid, entry": (args) =>
				(args[0] as number) < 7
					? [{ rowid: 7, entry: JSON.stringify(strengthEntry) }]
					: [],
			"COALESCE(MAX(rowid)": [{ max: 7 }],
		})
		const response = await GET(
			createEndpointContext("/api/body/log?since=0"),
			client,
		)
		expect(response.status).toBe(200)
		const body = await parseJsonResponse<{
			entries: unknown[]
			cursor: number
			max: number
		}>(response)
		expect(body.entries).toEqual([strengthEntry])
		expect(body.cursor).toBe(7)
		expect(body.max).toBe(7)
		expect(response.headers.get("Cache-Control")).toBe("no-store")
	})

	it("keeps the cursor put and reports max when nothing is new", async () => {
		const response = await GET(
			createEndpointContext("/api/body/log?since=7"),
			createMockDbClient({ "COALESCE(MAX(rowid)": [{ max: 2 }] }),
		)
		const body = await parseJsonResponse<{
			entries: unknown[]
			cursor: number
			max: number
		}>(response)
		expect(body.entries).toEqual([])
		expect(body.cursor).toBe(7)
		expect(body.max).toBe(2)
	})

	it("rejects a malformed cursor", async () => {
		const response = await GET(
			createEndpointContext("/api/body/log?since=abc"),
			createMockDbClient(),
		)
		expect(response.status).toBe(400)
	})
})

describe("POST /api/body/log", () => {
	const post = (body: BodyInit, token?: string) =>
		POST(
			createEndpointContext("/api/body/log", {
				method: "POST",
				body,
				headers: token ? { authorization: `Bearer ${token}` } : {},
			}),
			createMockDbClient({
				// One mocked row signals rowsAffected 1 for each insert.
				"INSERT OR IGNORE": (args) => [args],
			}),
		)

	it("inserts a pushed batch with the sync token", async () => {
		const response = await post(
			JSON.stringify({ entries: [strengthEntry] }),
			TOKEN,
		)
		expect(response.status).toBe(201)
		const body = await parseJsonResponse<{ inserted: number }>(response)
		expect(body.inserted).toBe(1)
	})

	it("rejects a missing or wrong token", async () => {
		const payload = JSON.stringify({ entries: [strengthEntry] })
		expect((await post(payload)).status).toBe(401)
		expect((await post(payload, "wrong")).status).toBe(401)
	})

	it("rejects a malformed batch", async () => {
		expect(
			(await post(JSON.stringify({ entries: [{ nope: true }] }), TOKEN)).status,
		).toBe(400)
		expect((await post("not json", TOKEN)).status).toBe(400)
	})
})
