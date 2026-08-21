// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { sync } from "$src/client/sync"
import { readLog } from "$src/logStore"
import {
	conditioningEntrySchema,
	LOG_SCHEMA_VERSION,
	LOG_WIRE_VERSION,
	strengthEntrySchema,
} from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

const preWellnessLogEntrySchema = z.discriminatedUnion("kind", [
	strengthEntrySchema,
	conditioningEntrySchema,
])

/** Valid under the new union, at the SAME schemaVersion the old union expects. */
const wellnessEntry = {
	kind: "wellness",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: "44444444-4444-4444-8444-444444444444",
	date: "2026-08-20",
	sleepHours: 7.5,
	steps: 9000,
}

const ok = (payload: unknown) => new Response(JSON.stringify(payload))

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
})

describe("wellness kind vs versioned pull cursor", () => {
	it("needs the wire bump: the old union rejects a v1 wellness entry", () => {
		expect(preWellnessLogEntrySchema.safeParse(wellnessEntry).success).toBe(
			false,
		)
	})

	it("ignores the cursor a stale client advanced, and recovers the entry", async () => {
		localStorage.setItem(`body-sync-cursor-v${LOG_WIRE_VERSION - 1}`, "9")
		const urls: string[] = []
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				urls.push(url)
				const since = Number(new URL(url).searchParams.get("since") ?? 0)
				if (since < 9)
					return ok({ entries: [wellnessEntry], cursor: 9, max: 9 })
				return ok({ entries: [], cursor: since, max: 9 })
			}),
		)

		await sync()
		expect(urls[0]).toContain("since=0")
		expect(await readLog()).toHaveLength(1)
	})
})
