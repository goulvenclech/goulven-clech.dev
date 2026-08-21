// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { sync } from "$src/client/sync"
import { fetchLog } from "$src/pages/log.md"
import { memoryStorage } from "./memoryStorage"

/**
 * Loop termination in fetchLog and pull depends on the response's `max`
 * field. The two sites deploy separately, so a version-skewed (or
 * proxy-mangled) response can omit it; `cursor >= NaN` is always false and
 * the loop must still terminate rather than refetch forever.
 */

const finiteStub = (payload: unknown) => {
	let calls = 0
	const stub = async () => {
		calls += 1
		if (calls > 4) throw new Error("pagination loop did not terminate")
		return new Response(JSON.stringify(payload), { status: 200 })
	}
	return { stub, count: () => calls }
}

describe("pagination termination without a numeric max", () => {
	beforeEach(() => {
		globalThis.indexedDB = new IDBFactory()
		vi.stubGlobal("localStorage", memoryStorage())
	})

	it("fetchLog returns instead of refetching when max is absent", async () => {
		const { stub, count } = finiteStub({ entries: [], cursor: 5 })
		await expect(fetchLog(stub)).resolves.toEqual({ entries: [], skipped: 0 })
		expect(count()).toBeLessThanOrEqual(2)
	})

	it("sync's pull returns instead of refetching when max is absent", async () => {
		const { stub, count } = finiteStub({ entries: [], cursor: 0 })
		vi.stubGlobal("fetch", stub)
		const result = await sync()
		expect(result.offline).toBe(false)
		expect(count()).toBeLessThanOrEqual(2)
	})

	it("fetchLog returns when the cursor stops advancing below max", async () => {
		const { stub, count } = finiteStub({ entries: [], cursor: 5, max: 9 })
		await expect(fetchLog(stub)).resolves.toEqual({ entries: [], skipped: 0 })
		expect(count()).toBeLessThanOrEqual(2)
	})

	it("sync's pull returns when the cursor stops advancing below max", async () => {
		const { stub, count } = finiteStub({ entries: [], cursor: 5, max: 9 })
		vi.stubGlobal("fetch", stub)
		const result = await sync()
		expect(result.offline).toBe(false)
		expect(count()).toBeLessThanOrEqual(2)
	})
})
