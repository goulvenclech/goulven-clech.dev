// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToday } from "$src/client/today"
import { appendEntries, readLog } from "$src/logStore"
import { LOG_SCHEMA_VERSION, type LogEntry } from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

/** Wednesday: the weekly plan schedules Combat. */
const WEDNESDAY = "2026-08-19"
const TUESDAY = "2026-08-18"
/** Thursday: the plan's midweek day off. */
const THURSDAY = "2026-08-20"
/** Monday: the weekly plan schedules strength-a. */
const MONDAY = "2026-08-17"

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

async function render(): Promise<HTMLElement> {
	const root = document.createElement("div")
	// Connected: a detached form never submits.
	document.body.replaceChildren(root)
	await renderToday(root)
	return root
}

const buttonsIn = (root: HTMLElement) =>
	[...root.querySelectorAll("button")].filter(
		(button) => !button.closest("dialog"),
	)

const skipDialogIn = (root: HTMLElement) =>
	[...root.querySelectorAll("dialog")].find((dialog) =>
		dialog.querySelector("#skip-reason"),
	)!

const submitButton = (dialog: HTMLDialogElement) =>
	dialog.querySelector<HTMLButtonElement>("button[type=submit]")!

const alertsIn = (root: ParentNode) =>
	[...root.querySelectorAll("[role=alert]")]
		.map((node) => node.textContent)
		.join(" ")

function openSkip(root: HTMLElement, reason = "ill"): HTMLDialogElement {
	const dialog = skipDialogIn(root)
	buttonsIn(root)
		.find((button) => button.textContent === "Skip session")!
		.click()
	dialog.querySelector<HTMLInputElement>("#skip-reason")!.value = reason
	return dialog
}

const skippedIn = (log: readonly LogEntry[]) =>
	log.filter((entry) => entry.kind === "skipped")

const strengthSet = (date: string): LogEntry => ({
	kind: "strength",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: crypto.randomUUID(),
	date,
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg: 60,
	reps: 5,
	unit: "reps",
})

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
	localStorage.setItem("body-sync-token", "tok")
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
	// Fake only Date so IndexedDB's real timers still run.
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(new Date(`${WEDNESDAY}T10:00:00Z`))
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe("skipping today's session", () => {
	it("records the planned type and the reason, and says so afterwards", async () => {
		const root = await render()
		const dialog = openSkip(root, "sick in bed")
		submitButton(dialog).click()
		await settle()

		expect(await readLog()).toEqual([
			expect.objectContaining({
				kind: "skipped",
				date: WEDNESDAY,
				planned: "Combat",
				reason: "sick in bed",
			}),
		])
		expect(root.textContent).toContain("Combat skipped")
		expect(root.textContent).toContain("sick in bed")
	})

	it("stamps the strength day with its own type", async () => {
		vi.setSystemTime(new Date(`${MONDAY}T10:00:00Z`))
		const root = await render()
		submitButton(openSkip(root)).click()
		await settle()

		expect(skippedIn(await readLog())).toEqual([
			expect.objectContaining({ date: MONDAY, planned: "Strength" }),
		])
	})

	it("refuses a skip with no reason: that is what an unlogged day already is", async () => {
		const root = await render()
		const dialog = openSkip(root, "  ")
		submitButton(dialog).click()
		await settle()

		expect(await readLog()).toEqual([])
		expect(dialog.open).toBe(true)
		expect(alertsIn(dialog)).toContain("Say why")
	})

	it("takes yesterday's sleep and steps along with the skip", async () => {
		const root = await render()
		const dialog = openSkip(root)
		dialog.querySelector<HTMLInputElement>(".wellness-sleep")!.value = "9"
		dialog.querySelector<HTMLInputElement>(".wellness-steps")!.value = "4200"
		submitButton(dialog).click()
		await settle()

		// The log comes back in id order, so the pair is asserted unordered.
		expect(await readLog()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "skipped", date: WEDNESDAY }),
				expect.objectContaining({
					kind: "wellness",
					date: TUESDAY,
					sleepHours: 9,
					steps: 4200,
				}),
			]),
		)
		expect(await readLog()).toHaveLength(2)
	})

	it("still offers yesterday's wellness once the day is skipped", async () => {
		await appendEntries([
			{
				kind: "skipped",
				schemaVersion: LOG_SCHEMA_VERSION,
				id: crypto.randomUUID(),
				date: WEDNESDAY,
				planned: "Combat",
				reason: "ill",
			},
		])
		const root = await render()

		expect(root.textContent).toContain("Yesterday — Tue 18 Aug")
		root.querySelector<HTMLInputElement>(".wellness-sleep")!.value = "8"
		root.querySelector<HTMLButtonElement>("form button")!.click()
		await settle()

		expect(await readLog()).toContainEqual(
			expect.objectContaining({
				kind: "wellness",
				date: TUESDAY,
				sleepHours: 8,
			}),
		)
	})

	it("offers no way to log a session already skipped", async () => {
		await appendEntries([
			{
				kind: "skipped",
				schemaVersion: LOG_SCHEMA_VERSION,
				id: crypto.randomUUID(),
				date: WEDNESDAY,
				planned: "Combat",
				reason: "ill",
			},
			// Both metrics in: not even the wellness form is left.
			{
				kind: "wellness",
				schemaVersion: LOG_SCHEMA_VERSION,
				id: crypto.randomUUID(),
				date: TUESDAY,
				sleepHours: 8,
				steps: 9000,
			},
		])
		const root = await render()

		expect(buttonsIn(root)).toEqual([])
		expect(root.querySelector("dialog")).toBeNull()
	})

	it("offers no gym weigh-in for a strength session that was skipped", async () => {
		vi.setSystemTime(new Date(`${MONDAY}T10:00:00Z`))
		await appendEntries([
			{
				kind: "skipped",
				schemaVersion: LOG_SCHEMA_VERSION,
				id: crypto.randomUUID(),
				date: MONDAY,
				planned: "Strength",
				reason: "ill",
			},
		])
		const root = await render()

		expect(
			[...root.querySelectorAll("legend")].map((legend) => legend.textContent),
		).toEqual(["Yesterday — Sun 16 Aug"])
		expect(root.querySelector(".wellness-weight")).toBeNull()
		expect(buttonsIn(root).map((button) => button.textContent)).toEqual([
			"Log yesterday",
		])
	})

	it("offers no skip once part of the session is logged", async () => {
		vi.setSystemTime(new Date(`${MONDAY}T10:00:00Z`))
		await appendEntries([strengthSet(MONDAY)])
		const root = await render()

		expect(buttonsIn(root).map((button) => button.textContent)).toEqual([
			"Log session",
		])
	})

	it("labels its own wellness fields, with the log dialog beside it", async () => {
		const root = await render()
		const labels = [
			...root.querySelectorAll<HTMLLabelElement>("fieldset.wellness label"),
		]

		expect(labels.length).toBeGreaterThan(1)
		for (const label of labels) {
			const target = document.getElementById(label.htmlFor)
			// Duplicate ids would resolve every label to the first dialog's input.
			expect(target?.closest("dialog")).toBe(label.closest("dialog"))
		}
	})

	it("gates the skip behind the sync password", async () => {
		localStorage.removeItem("body-sync-token")
		const root = await render()
		buttonsIn(root)
			.find((button) => button.textContent === "Skip session")!
			.click()

		expect(skipDialogIn(root).open).toBe(false)
		expect(root.querySelector("dialog")!.open).toBe(true)
	})
})

describe("catching up on missed days", () => {
	beforeEach(async () => {
		vi.setSystemTime(new Date(`${THURSDAY}T10:00:00Z`))
		await appendEntries([strengthSet(MONDAY)])
	})

	it("marks the days that came and went, once the log is known complete", async () => {
		vi.stubGlobal("fetch", async () =>
			Response.json({ entries: [], cursor: 0, max: 0 }),
		)
		await render()
		await settle()

		expect(
			skippedIn(await readLog()).map((entry) => [entry.date, entry.planned]),
		).toEqual([
			["2026-08-18", "Cardio"],
			["2026-08-19", "Combat"],
		])
	})

	it("leaves the marking to the owner's device", async () => {
		localStorage.removeItem("body-sync-token")
		vi.stubGlobal("fetch", async () =>
			Response.json({ entries: [], cursor: 0, max: 0 }),
		)
		await render()
		await settle()

		expect(skippedIn(await readLog())).toEqual([])
	})

	it("invents no miss from a log it could not finish pulling", async () => {
		await render()
		await settle()

		expect(skippedIn(await readLog())).toEqual([])
	})
})
