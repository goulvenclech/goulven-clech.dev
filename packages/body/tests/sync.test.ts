// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { requestSyncToken, sync, syncToken } from "$src/client/sync"
import { appendEntries, pendingCount, readLog } from "$src/logStore"
import { LOG_WIRE_VERSION, type LogEntry } from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

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

const ok = (payload: unknown, status = 200) =>
	new Response(JSON.stringify(payload), { status })

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
})

describe("requestSyncToken", () => {
	it("stores the token the password buys", async () => {
		vi.stubGlobal("fetch", async () => ok({ token: "tok" }))
		expect(await requestSyncToken("secret")).toBe("ok")
		expect(syncToken()).toBe("tok")
	})

	it("tells a wrong password apart from an unreachable backend", async () => {
		vi.stubGlobal("fetch", async () => ok({ error: "Unauthorized" }, 401))
		expect(await requestSyncToken("wrong")).toBe("unauthorized")
		vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
		expect(await requestSyncToken("secret")).toBe("offline")
		expect(syncToken()).toBeNull()
	})
})

describe("sync", () => {
	it("pulls remote entries into the store and advances the cursor", async () => {
		const fetchMock = vi.fn(async () =>
			ok({ entries: [remoteEntry], cursor: 7, max: 7 }),
		)
		vi.stubGlobal("fetch", fetchMock)

		const first = await sync()
		expect(first.pulled).toBe(1)
		expect(await readLog()).toEqual([remoteEntry])
		expect(await pendingCount()).toBe(0)

		fetchMock.mockImplementation(async () =>
			ok({ entries: [], cursor: 7, max: 7 }),
		)
		const second = await sync()
		expect(second.pulled).toBe(0)
		expect(fetchMock).toHaveBeenLastCalledWith(
			expect.stringContaining("since=7"),
		)
	})

	it("keeps pulling while pages come back full", async () => {
		const fullPage = Array.from({ length: 500 }, (_, index) => ({
			...remoteEntry,
			id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
		}))
		const urls: string[] = []
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				urls.push(url)
				return url.includes("since=0")
					? ok({ entries: fullPage, cursor: 500, max: 501 })
					: ok({ entries: [localEntry], cursor: 501, max: 501 })
			}),
		)

		const result = await sync()
		expect(urls).toEqual([
			expect.stringContaining("since=0"),
			expect.stringContaining("since=500"),
		])
		expect(result.pulled).toBe(501)
		expect(await readLog()).toHaveLength(501)
	})

	it("re-pulls from scratch when the server log was rebuilt", async () => {
		localStorage.setItem(`body-sync-cursor-v${LOG_WIRE_VERSION}`, "999")
		const urls: string[] = []
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				urls.push(url)
				return url.includes("since=999")
					? ok({ entries: [], cursor: 999, max: 1 })
					: ok({ entries: [remoteEntry], cursor: 1, max: 1 })
			}),
		)

		const result = await sync()
		expect(urls).toEqual([
			expect.stringContaining("since=999"),
			expect.stringContaining("since=0"),
		])
		expect(result.pulled).toBe(1)
		expect(await readLog()).toEqual([remoteEntry])
	})

	it("pushes the outbox with the bearer token and drains it", async () => {
		localStorage.setItem("body-sync-token", "tok")
		await appendEntries([localEntry])

		const calls: { url: string; init?: RequestInit }[] = []
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string, init?: RequestInit) => {
				calls.push({ url, init })
				return init?.method === "POST"
					? ok({ inserted: 1 }, 201)
					: ok({ entries: [], cursor: 0 })
			}),
		)

		const result = await sync()
		expect(result.pushed).toBe(1)
		expect(result.pending).toBe(0)
		const post = calls.find((call) => call.init?.method === "POST")!
		expect(post.init?.headers).toMatchObject({ authorization: "Bearer tok" })
		expect(JSON.parse(String(post.init?.body))).toEqual({
			entries: [localEntry],
		})
	})

	it("holds pushes and asks for the password again on 401", async () => {
		localStorage.setItem("body-sync-token", "stale")
		await appendEntries([localEntry])
		vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
			init?.method === "POST"
				? ok({ error: "Unauthorized" }, 401)
				: ok({ entries: [], cursor: 0 }),
		)

		const result = await sync()
		expect(result.authRequired).toBe(true)
		expect(result.pending).toBe(1)
		expect(syncToken()).toBeNull()
		expect(await readLog()).toEqual([localEntry])
	})

	it("treats an unreachable backend as a quiet no-op", async () => {
		await appendEntries([localEntry])
		localStorage.setItem("body-sync-token", "tok")
		vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))

		const result = await sync()
		expect(result).toMatchObject({ pulled: 0, pushed: 0, offline: true })
		expect(result.pending).toBe(1)
	})
})
