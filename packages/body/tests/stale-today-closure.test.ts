// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { renderToday } from "$src/client/today"
import { readLog } from "$src/logStore"

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
	// Fake only Date so IndexedDB's real timers still run.
	vi.useFakeTimers({ toFake: ["Date"] })
})

afterEach(() => {
	vi.useRealTimers()
})

it("never logs sets under a past date after the tab resumes on a later day", async () => {
	// Monday noon, Europe/Paris: strength-a day.
	vi.setSystemTime(new Date("2026-08-17T10:00:00Z"))
	const root = document.createElement("div")
	await renderToday(root)

	vi.setSystemTime(new Date("2026-08-18T07:00:00Z"))

	const row = root.querySelector(".set-row")!
	row.querySelector<HTMLInputElement>(".set-kg")!.value = "60"
	row.querySelector<HTMLInputElement>(".set-reps")!.value = "5"
	row.querySelector<HTMLInputElement>(".set-rir")!.value = "2"
	const logButton = [...root.querySelectorAll("button")].find(
		(button) => button.textContent === "Log sets",
	)!
	logButton.click()
	await new Promise((resolve) => setTimeout(resolve, 100))

	const log = await readLog()
	// Either nothing was written or the entries carry the current day.
	for (const entry of log) expect(entry.date).toBe("2026-08-18")
})
