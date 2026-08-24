// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderLog } from "$src/client/log"
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
	category: "Cardio",
	workout: "w".repeat(3000),
	level: 3,
	sets: 5,
}

const localEntry: LogEntry = {
	kind: "conditioning",
	schemaVersion: 1,
	id: "22222222-2222-4222-8222-222222222222",
	date: "2026-08-18",
	category: "Cardio",
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

	it("gives up once refusals pile up, keeping the entry in the log", async () => {
		localStorage.setItem("body-sync-token", "tok")
		await appendEntries([localEntry])
		vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
			init?.method === "POST"
				? ok({ error: "Bad Request" }, 400)
				: ok({ entries: [], cursor: 0, max: 0 }),
		)

		expect(await sync()).toMatchObject({ rejected: true, abandoned: 0 })
		expect(await sync()).toMatchObject({ rejected: true, abandoned: 0 })
		expect(await pendingCount()).toBe(1)

		expect(await sync()).toMatchObject({ rejected: true, abandoned: 1 })
		expect(await pendingCount()).toBe(0)
		expect(await readLog()).toContainEqual(localEntry)

		expect(await sync()).toMatchObject({ rejected: false, abandoned: 0 })
	})

	it("never gives up on an outage, however long it lasts", async () => {
		localStorage.setItem("body-sync-token", "tok")
		await appendEntries([localEntry])
		let pushes = 0
		vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
			if (init?.method !== "POST") return ok({ entries: [], cursor: 0, max: 0 })
			pushes++
			// Well past the limit a refusal of the data would have hit.
			return pushes <= 5
				? ok({ error: "Server error" }, 500)
				: ok({ inserted: 1 }, 201)
		})

		for (let attempt = 0; attempt < 5; attempt++)
			expect(await sync()).toMatchObject({ rejected: true, abandoned: 0 })
		expect(await pendingCount()).toBe(1)

		expect(await sync()).toMatchObject({ pushed: 1, rejected: false })
		expect(await pendingCount()).toBe(0)
	})

	it("reports what it gave up on, even from another screen", async () => {
		localStorage.setItem("body-sync-token", "tok")
		await appendEntries([localEntry])
		vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
			init?.method === "POST"
				? ok({ error: "Bad Request" }, 400)
				: ok({ entries: [], cursor: 0, max: 0 }),
		)
		for (let attempt = 0; attempt < 3; attempt++) await sync()
		expect(await pendingCount()).toBe(0)

		const root = document.createElement("div")
		await renderLog(root)
		await new Promise((resolve) => setTimeout(resolve, 100))

		expect(root.textContent).toContain(
			"1 entry could not be synced and will stay on this device.",
		)
	})

	it("says it is still trying while the entry keeps its place", async () => {
		localStorage.setItem("body-sync-token", "tok")
		await appendEntries([localEntry])
		vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
			init?.method === "POST"
				? ok({ error: "Server error" }, 500)
				: ok({ entries: [], cursor: 0, max: 0 }),
		)

		const root = document.createElement("div")
		await renderLog(root)
		await new Promise((resolve) => setTimeout(resolve, 100))

		expect(root.textContent).toContain("try again on the next visit")
		expect(await pendingCount()).toBe(1)
	})
})
