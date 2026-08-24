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

const ok = (payload: unknown, status = 200) =>
	new Response(JSON.stringify(payload), { status })

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
})

afterEach(() => {
	vi.unstubAllGlobals()
})

it("surfaces a way back into sync when auto-sync hits a 401", async () => {
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
		expect(localStorage.getItem("body-sync-token")).toBeNull(),
	)

	const surfaced =
		root.textContent!.includes("Enable sync") ||
		(root.querySelector("[role=alert]")?.textContent ?? "") !== ""
	expect(surfaced).toBe(true)
})
