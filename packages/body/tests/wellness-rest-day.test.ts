// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToday } from "$src/client/today"
import { appendEntries, readLog } from "$src/logStore"
import { LOG_SCHEMA_VERSION } from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

/** Sunday: the weekly plan's rest day. */
const SUNDAY = "2026-08-23"
const SATURDAY = "2026-08-22"

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

const sleepInput = (scope: ParentNode) =>
	scope.querySelector<HTMLInputElement>(".wellness-sleep")
const stepsInput = (scope: ParentNode) =>
	scope.querySelector<HTMLInputElement>(".wellness-steps")

const submit = (root: HTMLElement) =>
	root.querySelector<HTMLButtonElement>("form button")!.click()

const alertsIn = (root: ParentNode) =>
	[...root.querySelectorAll("[role=alert]")]
		.map((node) => node.textContent)
		.join(" ")

async function renderSunday(): Promise<HTMLElement> {
	const root = document.createElement("div")
	// Connected: a detached form never submits.
	document.body.replaceChildren(root)
	await renderToday(root)
	return root
}

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
	localStorage.setItem("body-sync-token", "tok")
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
	// Fake only Date so IndexedDB's real timers still run.
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(new Date(`${SUNDAY}T10:00:00Z`))
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe("the rest day", () => {
	it("offers Saturday's sleep and steps, and logs them", async () => {
		const root = await renderSunday()

		expect(root.textContent).toContain("Yesterday — Sat 22 Aug")
		sleepInput(root)!.value = "9"
		stepsInput(root)!.value = "4200"
		submit(root)
		await settle()

		expect(await readLog()).toEqual([
			expect.objectContaining({
				kind: "wellness",
				date: SATURDAY,
				sleepHours: 9,
				steps: 4200,
			}),
		])
		expect(root.querySelector("form")).toBeNull()
		expect(root.textContent).toContain("Nothing to log today")
	})

	it("refuses a blank submission with a note", async () => {
		const root = await renderSunday()
		submit(root)
		await settle()

		expect(alertsIn(root)).toContain("Nothing to log")
		expect(await readLog()).toEqual([])
	})

	it("discards a submission after midnight, and says so", async () => {
		const root = await renderSunday()
		sleepInput(root)!.value = "8"

		vi.setSystemTime(new Date("2026-08-24T07:00:00Z"))
		submit(root)
		await settle()

		expect(await readLog()).toEqual([])
		expect(alertsIn(root)).toContain("nothing was saved")
	})

	it("gates logging behind the sync password", async () => {
		localStorage.removeItem("body-sync-token")
		const root = await renderSunday()

		expect(sleepInput(root)).toBeNull()
		const gate = [...root.querySelectorAll("button")].find(
			(button) => button.textContent === "Log yesterday",
		)!
		gate.click()
		expect(root.querySelector("dialog")!.open).toBe(true)
	})

	it("renders no form once both metrics are already logged", async () => {
		await appendEntries([
			{
				kind: "wellness",
				schemaVersion: LOG_SCHEMA_VERSION,
				id: crypto.randomUUID(),
				date: SATURDAY,
				sleepHours: 8,
				steps: 11000,
			},
		])
		const root = await renderSunday()

		expect(root.querySelector("form")).toBeNull()
		expect(root.textContent).toContain("Nothing to log today")
	})
})
