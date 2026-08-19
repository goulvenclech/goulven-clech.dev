import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it, vi } from "vitest"
import { createClient, type Client, type InStatement } from "@libsql/client"

// sessions.ts (and $src/db) import astro:env/server, which only exists inside
// an Astro build; mock it so the handler can be imported under vitest.
vi.mock("astro:env/server", () => ({
	BODY_PASSWORD: "test-password",
	TURSO_URL: "file::memory:",
	TURSO_TOKEN: "",
}))

import { POST } from "$src/pages/api/sessions"

const SCHEMA = readFileSync(
	new URL("../db/schema.sql", import.meta.url),
	"utf-8",
)

// A past Monday (kind "strength", not "rest") so the payload validates.
const DATE = "2026-08-17"

function postRequest() {
	return new Request("http://localhost/api/sessions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			password: "test-password",
			date: DATE,
			status: "completed",
			notes: "",
			sets: [],
		}),
	})
}

// A temp file, not `file::memory:`: the sqlite3-flavoured client hands its
// connection to each transaction and lazily opens a new one afterwards, and
// every new `:memory:` connection is a fresh empty database.
const dbDir = mkdtempSync(join(tmpdir(), "body-race-test-"))
afterAll(() => rmSync(dbDir, { recursive: true, force: true }))

async function freshDb(): Promise<Client> {
	const client = createClient({ url: `file:${join(dbDir, "test.db")}` })
	await client.executeMultiple(SCHEMA)
	return client
}

/**
 * Simulates the loser of a duplicate-session race: its `getSessionByDate`
 * check ran before the winner's insert committed (so it sees no row), but its
 * own insert lands after and hits the `date UNIQUE` constraint.
 */
function raceLoserClient(client: Client): {
	client: Client
	preCheckIntercepted: () => boolean
} {
	let intercepted = false
	return {
		preCheckIntercepted: () => intercepted,
		client: {
			execute: async (stmt: InStatement) => {
				const sql = typeof stmt === "string" ? stmt : stmt.sql
				if (/SELECT[\s\S]*FROM sessions WHERE date = \?/.test(sql)) {
					intercepted = true
					return { rows: [], columns: [], rowsAffected: 0 }
				}
				return client.execute(stmt)
			},
			transaction: (mode: "write" | "read" | "deferred") =>
				client.transaction(mode),
		} as unknown as Client,
	}
}

describe("POST /api/sessions duplicate-date race", () => {
	it("returns 409 when the pre-insert check misses a concurrent insert", async () => {
		const client = await freshDb()

		const winner = await POST(
			{ request: postRequest() } as Parameters<typeof POST>[0],
			client,
		)
		expect(winner.status).toBe(201)

		const loser = raceLoserClient(client)
		const response = await POST(
			{ request: postRequest() } as Parameters<typeof POST>[0],
			loser.client,
		)

		// Guards the simulation itself: if the pre-check SQL is ever reworded,
		// this must fail loudly instead of passing through the non-race path.
		expect(loser.preCheckIntercepted()).toBe(true)
		expect(response.status).toBe(409)
	})
})
