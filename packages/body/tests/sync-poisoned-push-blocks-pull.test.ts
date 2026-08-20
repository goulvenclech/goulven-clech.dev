// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { sync } from "$src/client/sync"
import { appendEntries, pendingCount, readLog } from "$src/logStore"
import { logEntrySchema, type LogEntry } from "$src/schemas"
import { parseIncomingEntries } from "../../../src/bodyLog"
import { memoryStorage } from "./memoryStorage"

const oversizeEntry = {
	kind: "conditioning",
	schemaVersion: 1,
	id: "33333333-3333-4333-8333-333333333333",
	date: "2026-08-18",
	workout: "w".repeat(3000),
	level: 3,
	sets: 5,
}

const localEntry: LogEntry = {
	kind: "conditioning",
	schemaVersion: 1,
	id: "22222222-2222-4222-8222-222222222222",
	date: "2026-08-18",
	workout: "cardio",
	level: 3,
	sets: 5,
}

const remoteEntry: LogEntry = {
	kind: "strength",
	schemaVersion: 1,
	id: "11111111-1111-4111-8111-111111111111",
	date: "2026-08-17",
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg: 60,
	reps: 5,
	rir: 2,
	unit: "reps",
}

const ok = (payload: unknown, status = 200) =>
	new Response(JSON.stringify(payload), { status })

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
})

describe("server-rejected pushes", () => {
	it("cannot be provoked by a client-valid entry: the schema is tighter than the gate", () => {
		expect(logEntrySchema.safeParse(oversizeEntry).success).toBe(false)
		expect(parseIncomingEntries({ entries: [oversizeEntry] })).toBeNull()
	})

	it("report rejected — not offline — and never block the pull", async () => {
		localStorage.setItem("body-sync-token", "tok")
		await appendEntries([localEntry])

		vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
			init?.method === "POST"
				? ok({ error: "Bad Request" }, 400)
				: ok({ entries: [remoteEntry], cursor: 7, max: 7 }),
		)

		const result = await sync()
		expect(result.rejected).toBe(true)
		expect(result.offline).toBe(false)
		expect(result.pulled).toBe(1)
		expect(await pendingCount()).toBe(1)
		expect(await readLog()).toContainEqual(remoteEntry)
	})
})
