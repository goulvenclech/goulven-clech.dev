// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { sync } from "$src/client/sync"
import { readLog } from "$src/logStore"
import { LOG_SCHEMA_VERSION } from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

/** Valid under a hypothetical v2 schema, invalid (and dropped) under v1. */
const futureEntry = {
	kind: "strength",
	schemaVersion: LOG_SCHEMA_VERSION + 1,
	id: "33333333-3333-4333-8333-333333333333",
	date: "2026-08-19",
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg: 62.5,
	reps: 5,
	rir: 2,
	unit: "reps",
}

const ok = (payload: unknown) => new Response(JSON.stringify(payload))

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
})

describe("pull cursor vs schema evolution", () => {
	it("ignores a cursor persisted under the legacy unversioned key", async () => {
		localStorage.setItem("body-sync-cursor", "999")
		const urls: string[] = []
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				urls.push(url)
				return ok({ entries: [], cursor: 999 })
			}),
		)

		await sync()
		expect(urls[0]).toContain("since=0")
	})

	it("persists the pull cursor keyed by the log schema version", async () => {
		vi.stubGlobal("fetch", async () =>
			ok({ entries: [futureEntry], cursor: 9 }),
		)

		await sync()
		expect(await readLog()).toEqual([])
		expect(
			localStorage.getItem(`body-sync-cursor-v${LOG_SCHEMA_VERSION}`),
		).toBe("9")
		expect(localStorage.getItem("body-sync-cursor")).toBeNull()
	})
})
