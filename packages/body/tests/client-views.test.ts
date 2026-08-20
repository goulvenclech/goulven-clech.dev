// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest"
import { renderHistory } from "$src/client/history"
import { renderStats } from "$src/client/stats"
import { renderToday } from "$src/client/today"

beforeEach(() => {
	globalThis.indexedDB = {
		open: () => {
			const request = {
				onupgradeneeded: null,
				onsuccess: null,
				onerror: null as (() => void) | null,
				error: new Error("InvalidStateError: indexedDB.open failed"),
			}
			queueMicrotask(() => request.onerror?.())
			return request
		},
	} as unknown as IDBFactory
})

describe("client views when indexedDB refuses to open", () => {
	const views = [
		["renderToday", renderToday],
		["renderHistory", renderHistory],
		["renderStats", renderStats],
	] as const

	it.each(views)(
		"%s shows a storage warning instead of rejecting",
		async (_, render) => {
			const root = document.createElement("div")
			await expect(render(root)).resolves.toBeUndefined()
			expect(root.textContent).toContain("blocking storage")
		},
	)
})
