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
} from "$src/logStore"
import type { LogEntry } from "$src/schemas"

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

const conditioningEntry: LogEntry = {
	kind: "conditioning",
	schemaVersion: 1,
	id: "22222222-2222-4222-8222-222222222222",
	date: "2026-08-18",
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
