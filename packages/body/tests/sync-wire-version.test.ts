// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { sync } from "$src/client/sync"
import { mergeEntries, readLog } from "$src/logStore"
import {
	conditioningEntrySchema,
	LOG_SCHEMA_VERSION,
	LOG_WIRE_VERSION,
	retractionEntrySchema,
	skippedEntrySchema,
	strengthEntrySchema,
	wellnessEntrySchema,
} from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

const preWellnessLogEntrySchema = z.discriminatedUnion("kind", [
	strengthEntrySchema,
	conditioningEntrySchema,
])

const preSkippedLogEntrySchema = z.discriminatedUnion("kind", [
	strengthEntrySchema,
	conditioningEntrySchema,
	wellnessEntrySchema,
])

const preWeightWellnessSchema = z.strictObject({
	kind: z.literal("wellness"),
	schemaVersion: z.literal(LOG_SCHEMA_VERSION),
	id: z.uuid(),
	date: z.string(),
	sleepHours: z.number().positive().max(24).optional(),
	steps: z.number().int().positive().optional(),
})

const preWeightLogEntrySchema = z.discriminatedUnion("kind", [
	strengthEntrySchema,
	conditioningEntrySchema,
	preWeightWellnessSchema,
	skippedEntrySchema,
])

const preOptionalRirStrengthSchema = strengthEntrySchema.extend({
	rir: z.number().int().min(0).max(10),
})

const preRetractionLogEntrySchema = z.discriminatedUnion("kind", [
	strengthEntrySchema,
	conditioningEntrySchema,
	wellnessEntrySchema,
	skippedEntrySchema,
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

const rirlessStrengthEntry = {
	kind: "strength",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: "55555555-5555-4555-8555-555555555555",
	date: "2026-08-20",
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg: 60,
	reps: 5,
	unit: "reps",
}

const skippedEntry = {
	kind: "skipped",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: "66666666-6666-4666-8666-666666666666",
	date: "2026-08-20",
	planned: "Core",
	reason: "ill",
}

const weightEntry = {
	kind: "wellness",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: "77777777-7777-4777-8777-777777777777",
	date: "2026-08-20",
	weightKg: 72.4,
}

const retractionEntry = {
	kind: "retraction",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: "88888888-8888-4888-8888-888888888888",
	date: "2026-08-20",
	retracts: rirlessStrengthEntry.id,
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

describe("optional rir vs versioned pull cursor", () => {
	it("needs the wire bump: the old union rejects a rir-less strength entry", () => {
		expect(
			preOptionalRirStrengthSchema.safeParse(rirlessStrengthEntry).success,
		).toBe(false)
		// The new schema accepts it, so a stale client is the only one that drops it.
		expect(strengthEntrySchema.safeParse(rirlessStrengthEntry).success).toBe(
			true,
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
					return ok({ entries: [rirlessStrengthEntry], cursor: 9, max: 9 })
				return ok({ entries: [], cursor: since, max: 9 })
			}),
		)

		await sync()
		expect(urls[0]).toContain("since=0")
		expect(await readLog()).toHaveLength(1)
	})
})

describe("skipped kind vs versioned pull cursor", () => {
	it("needs the wire bump: the old union rejects a v1 skipped entry", () => {
		expect(preSkippedLogEntrySchema.safeParse(skippedEntry).success).toBe(false)
	})

	it("ignores the cursor a stale client advanced, and recovers the entry", async () => {
		localStorage.setItem(`body-sync-cursor-v${LOG_WIRE_VERSION - 1}`, "9")
		const urls: string[] = []
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				urls.push(url)
				const since = Number(new URL(url).searchParams.get("since") ?? 0)
				if (since < 9) return ok({ entries: [skippedEntry], cursor: 9, max: 9 })
				return ok({ entries: [], cursor: since, max: 9 })
			}),
		)

		await sync()
		expect(urls[0]).toContain("since=0")
		expect(await readLog()).toHaveLength(1)
	})
})

describe("weight field vs versioned pull cursor", () => {
	it("needs the wire bump: the old union rejects a weight entry", () => {
		expect(preWeightLogEntrySchema.safeParse(weightEntry).success).toBe(false)
		expect(wellnessEntrySchema.safeParse(weightEntry).success).toBe(true)
	})

	it("ignores the cursor a stale client advanced, and recovers the entry", async () => {
		localStorage.setItem(`body-sync-cursor-v${LOG_WIRE_VERSION - 1}`, "9")
		const urls: string[] = []
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				urls.push(url)
				const since = Number(new URL(url).searchParams.get("since") ?? 0)
				if (since < 9) return ok({ entries: [weightEntry], cursor: 9, max: 9 })
				return ok({ entries: [], cursor: since, max: 9 })
			}),
		)

		await sync()
		expect(urls[0]).toContain("since=0")
		expect(await readLog()).toHaveLength(1)
	})
})

describe("retraction kind vs versioned pull cursor", () => {
	it("needs the wire bump: the old union rejects a retraction", () => {
		expect(preRetractionLogEntrySchema.safeParse(retractionEntry).success).toBe(
			false,
		)
		expect(retractionEntrySchema.safeParse(retractionEntry).success).toBe(true)
	})

	it("ignores the cursor a stale client advanced, and applies the retraction", async () => {
		await mergeEntries([rirlessStrengthEntry])
		localStorage.setItem(`body-sync-cursor-v${LOG_WIRE_VERSION - 1}`, "9")
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				const since = Number(new URL(url).searchParams.get("since") ?? 0)
				if (since < 9)
					return ok({ entries: [retractionEntry], cursor: 9, max: 9 })
				return ok({ entries: [], cursor: since, max: 9 })
			}),
		)

		await sync()
		expect(await readLog()).toEqual([])
	})
})
