// @vitest-environment happy-dom
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderLog } from "$src/client/log"
import { appendEntries, readLog } from "$src/logStore"
import type { LogEntry } from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

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
	category: "Cardio",
	workout: "cardio",
	level: 3,
	sets: 5,
}

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
	localStorage.setItem("body-sync-token", "tok")
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
})

async function importFile(root: HTMLElement, contents: string): Promise<void> {
	await renderLog(root)
	const input = root.querySelector<HTMLInputElement>('input[type="file"]')
	if (!input) throw new Error("file input not rendered")
	Object.defineProperty(input, "files", {
		configurable: true,
		value: { 0: { text: async () => contents }, length: 1 },
	})
	input.dispatchEvent(new Event("change"))
}

describe("log import", () => {
	it("round-trips an exported log back into storage", async () => {
		const exported = [strengthEntry, conditioningEntry]
		await appendEntries(exported)
		const exportedJson = JSON.stringify(await readLog(), null, "\t")

		// Fresh device: new database, empty log.
		globalThis.indexedDB = new IDBFactory()
		const root = document.createElement("div")
		await importFile(root, exportedJson)

		await vi.waitFor(async () => {
			expect(await readLog()).toEqual(exported)
		})
		expect(root.textContent).not.toContain("Import failed")
	})

	it("shows the error note and stores nothing on an invalid file", async () => {
		const root = document.createElement("div")
		await importFile(root, "definitely not a log export")

		await vi.waitFor(() => {
			expect(root.textContent).toContain("Import failed")
		})
		expect(await readLog()).toEqual([])
	})

	it("refuses to open the file picker without a sync token", async () => {
		localStorage.removeItem("body-sync-token")
		const root = document.createElement("div")
		await renderLog(root)

		const button = [...root.querySelectorAll("button")].find(
			(candidate) => candidate.textContent === "Import JSON",
		)!
		button.click()

		expect(root.textContent).toContain("Import needs sync")
		expect(await readLog()).toEqual([])
	})
})
