import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { appendEntries } from "$src/logStore"
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

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
})

describe("logStore persist() prompting", () => {
	it("requests persistent storage at most once per session", async () => {
		const persist = vi.fn().mockResolvedValue(false)
		vi.stubGlobal("navigator", { storage: { persist } })
		try {
			await appendEntries([strengthEntry])
			await appendEntries([
				{
					...strengthEntry,
					id: "22222222-2222-4222-8222-222222222222",
					set: 2,
				},
			])
			expect(persist).toHaveBeenCalledTimes(1)
		} finally {
			vi.unstubAllGlobals()
		}
	})
})
