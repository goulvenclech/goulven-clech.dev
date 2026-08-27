// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderLog } from "$src/client/log"
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

afterEach(() => {
	vi.useRealTimers()
})

describe("client views when indexedDB refuses to open", () => {
	const views = [
		["renderToday", renderToday],
		["renderLog", renderLog],
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

describe("today's header", () => {
	it("names the session and the day, even when storage is blocked", async () => {
		// Fake only Date: the mocked indexedDB.open resolves via queueMicrotask.
		vi.useFakeTimers({ toFake: ["Date"] })
		vi.setSystemTime(new Date("2026-08-19T10:00:00Z"))
		document.body.innerHTML =
			'<h1><span id="page-title">Today</span></h1><p id="page-subtitle"></p>'

		await renderToday(document.createElement("div"))

		expect(document.getElementById("page-title")!.textContent).toBe("Combat")
		expect(document.getElementById("page-subtitle")!.textContent).toBe(
			"Wednesday 19 August, at home",
		)
	})

	it("labels a strength day by its type, not the session name", async () => {
		// A Friday, which the weekly plan schedules as strength-b.
		vi.useFakeTimers({ toFake: ["Date"] })
		vi.setSystemTime(new Date("2026-08-21T10:00:00Z"))
		document.body.innerHTML =
			'<h1><span id="page-title">Today</span></h1><p id="page-subtitle"></p>'

		await renderToday(document.createElement("div"))

		expect(document.getElementById("page-title")!.textContent).toBe("Strength")
		expect(document.getElementById("page-subtitle")!.textContent).toBe(
			"Friday 21 August, at the gym",
		)
	})

	it("marks a rest day as a day off", async () => {
		vi.useFakeTimers({ toFake: ["Date"] })
		vi.setSystemTime(new Date("2026-08-20T10:00:00Z"))
		document.body.innerHTML =
			'<h1><span id="page-title">Today</span></h1><p id="page-subtitle"></p>'

		await renderToday(document.createElement("div"))

		expect(document.getElementById("page-title")!.textContent).toBe("Rest")
		expect(document.getElementById("page-subtitle")!.textContent).toBe(
			"Thursday 20 August, day off",
		)
	})
})
