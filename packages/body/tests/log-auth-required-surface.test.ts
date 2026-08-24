// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { renderLog } from "$src/client/log"
import { appendEntries } from "$src/logStore"
import type { LogEntry } from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

const queuedEntry: LogEntry = {
	kind: "conditioning",
	schemaVersion: 1,
	id: "44444444-4444-4444-8444-444444444444",
	date: "2026-08-18",
	category: "Cardio",
	workout: "cardio",
	level: 3,
	sets: 5,
}

const pulledEntry: LogEntry = {
	kind: "conditioning",
	schemaVersion: 1,
	id: "55555555-5555-4555-8555-555555555555",
	date: "2026-08-19",
	category: "Cardio",
	workout: "other device sprints",
	level: 2,
	sets: 4,
}

const ok = (payload: unknown, status = 200) =>
	new Response(JSON.stringify(payload), { status })

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
})

afterEach(() => {
	vi.unstubAllGlobals()
})

it("says the password is needed again when auto-sync hits a 401", async () => {
	localStorage.setItem("body-sync-token", "stale-token")
	await appendEntries([queuedEntry])

	// Push: 401 (password rotated). Pull: nothing new, so no rerender path.
	vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) =>
		init?.method === "POST"
			? ok({ error: "Unauthorized" }, 401)
			: ok({ entries: [], cursor: 0, max: 0 }),
	)

	const root = document.createElement("div")
	await renderLog(root, true)

	await vi.waitFor(() =>
		expect(root.querySelector("[role=alert]")?.textContent).toContain(
			"Sync password needed again.",
		),
	)
	expect(localStorage.getItem("body-sync-token")).toBeNull()
})

it("still shows what the pull merged during that same sync", async () => {
	localStorage.setItem("body-sync-token", "stale-token")
	await appendEntries([queuedEntry])

	vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) =>
		init?.method === "POST"
			? ok({ error: "Unauthorized" }, 401)
			: ok({ entries: [pulledEntry], cursor: 1, max: 1 }),
	)

	const root = document.createElement("div")
	await renderLog(root, true)

	await vi.waitFor(() =>
		expect(root.textContent).toContain("other device sprints"),
	)
	expect(root.querySelector("[role=alert]")?.textContent).toContain(
		"Sync password needed again.",
	)
})

it("stays quiet when a device that never had a token cannot push", async () => {
	await appendEntries([queuedEntry])

	vi.stubGlobal("fetch", async () => ok({ entries: [], cursor: 0, max: 0 }))

	const root = document.createElement("div")
	await renderLog(root, true)
	await settle()

	expect(root.querySelector("[role=alert]")?.textContent).toBe("")
})
