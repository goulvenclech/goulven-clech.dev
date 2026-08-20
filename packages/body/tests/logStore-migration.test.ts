import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it } from "vitest"
import { appendEntries, pendingCount, readLog } from "$src/logStore"
import type { LogEntry } from "$src/schemas"

const strengthEntry: LogEntry = {
	kind: "strength",
	schemaVersion: 1,
	id: "44444444-4444-4444-8444-444444444444",
	date: "2026-08-17",
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg: 60,
	reps: 5,
	rir: 2,
	unit: "reps",
}

function seedOldShapeV1(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("body", 1)
		request.onupgradeneeded = () => {
			const store = request.result.createObjectStore("log", {
				autoIncrement: true,
			})
			store.add({ kind: "strength", date: "2026-08-01" })
		}
		request.onsuccess = () => {
			request.result.close()
			resolve()
		}
		request.onerror = () => reject(request.error)
	})
}

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
})

describe("upgrade from the v1 database shape", () => {
	it("recreates the stores and works; un-id'd v1 data is dropped", async () => {
		await seedOldShapeV1()
		await appendEntries([strengthEntry])
		expect(await readLog()).toEqual([strengthEntry])
		expect(await pendingCount()).toBe(1)
	})
})
