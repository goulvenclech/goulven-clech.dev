import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it } from "vitest"
import {
	appendEntries,
	clearOutbox,
	mergeEntries,
	outboxEntries,
	pendingCount,
	readLog,
	recordPushFailure,
} from "$src/logStore"
import { logEntrySchema, type LogEntry } from "$src/schemas"

const strengthEntry: LogEntry = {
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

/** The sync gate's per-entry cap, in src/bodyLog.ts on the main site. */
const MAX_ENTRY_BYTES = 2048
const MAX_CATEGORY = 64
const MAX_WORKOUT = 200

const conditioningEntry: LogEntry = {
	kind: "conditioning",
	schemaVersion: 1,
	id: "22222222-2222-4222-8222-222222222222",
	date: "2026-08-18",
	category: "Cardio",
	workout: "cardio",
	level: 3,
	sets: 5,
}

const third: LogEntry = {
	...strengthEntry,
	id: "33333333-3333-4333-8333-333333333333",
	set: 2,
}

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
})

describe("appendEntries", () => {
	it("reads back appended entries and queues them for push", async () => {
		await appendEntries([strengthEntry, conditioningEntry])
		await appendEntries([third])
		expect(await readLog()).toHaveLength(3)
		expect(await pendingCount()).toBe(3)
		expect(await outboxEntries()).toContainEqual(conditioningEntry)
	})

	it("rejects an invalid entry before anything is written", async () => {
		await expect(
			appendEntries([strengthEntry, { ...third, reps: 0 }]),
		).rejects.toThrow()
		expect(await readLog()).toEqual([])
	})

	it("fails loudly on a reused id", async () => {
		await appendEntries([strengthEntry])
		await expect(
			appendEntries([{ ...strengthEntry, set: 2 }]),
		).rejects.toThrow()
	})
})

describe("mergeEntries", () => {
	it("unions by id, skipping entries already present", async () => {
		await appendEntries([strengthEntry])
		const added = await mergeEntries(
			[strengthEntry, conditioningEntry, { garbage: true }],
			{ queue: false },
		)
		expect(added).toBe(1)
		expect(await readLog()).toHaveLength(2)
		expect(await pendingCount()).toBe(1)
	})

	it("queues imported entries so a restored backup gets pushed", async () => {
		const added = await mergeEntries([strengthEntry, conditioningEntry], {
			queue: true,
		})
		expect(added).toBe(2)
		expect(await pendingCount()).toBe(2)
	})

	it("is idempotent", async () => {
		await mergeEntries([strengthEntry], { queue: false })
		expect(await mergeEntries([strengthEntry], { queue: false })).toBe(0)
		expect(await readLog()).toHaveLength(1)
	})
})

describe("outbox", () => {
	it("drains cleared ids and keeps the rest", async () => {
		await appendEntries([strengthEntry, conditioningEntry])
		await clearOutbox([strengthEntry.id])
		expect(await pendingCount()).toBe(1)
		expect(await outboxEntries()).toEqual([conditioningEntry])
	})
})

it("keeps a maximal valid entry inside the sync gate's size cap", () => {
	// Control characters cost six bytes each once JSON-escaped: the worst case.
	const fill = (length: number) => "\u0000".repeat(length)
	const biggest: LogEntry = {
		...conditioningEntry,
		category: fill(MAX_CATEGORY),
		workout: fill(MAX_WORKOUT),
		level: 5,
		sets: Number.MAX_SAFE_INTEGER,
	}

	// The lengths the budget below assumes are the ones the schema enforces.
	expect(() => logEntrySchema.parse(biggest)).not.toThrow()
	expect(() =>
		logEntrySchema.parse({ ...biggest, workout: fill(MAX_WORKOUT + 1) }),
	).toThrow()

	expect(new TextEncoder().encode(JSON.stringify(biggest)).length).toBeLessThan(
		MAX_ENTRY_BYTES,
	)
})

it("counts a refusal against an entry queued before attempts were tracked", async () => {
	await appendEntries([conditioningEntry])
	// The old shape: the value was a second copy of the key, not a count.
	await new Promise<void>((resolve, reject) => {
		const open = indexedDB.open("body", 2)
		open.onsuccess = () => {
			const db = open.result
			const transaction = db.transaction("outbox", "readwrite")
			transaction
				.objectStore("outbox")
				.put(conditioningEntry.id, conditioningEntry.id)
			transaction.oncomplete = () => {
				db.close()
				resolve()
			}
			transaction.onerror = () => reject(transaction.error)
		}
		open.onerror = () => reject(open.error)
	})

	expect(await outboxEntries()).toContainEqual(conditioningEntry)
	expect(await recordPushFailure([conditioningEntry.id], 3)).toBe(0)
	expect(await pendingCount()).toBe(1)
})

it("leaves an entry a concurrent push already cleared alone", async () => {
	await appendEntries([conditioningEntry])
	await clearOutbox([conditioningEntry.id])

	expect(await recordPushFailure([conditioningEntry.id], 3)).toBe(0)
	expect(await pendingCount()).toBe(0)
})
