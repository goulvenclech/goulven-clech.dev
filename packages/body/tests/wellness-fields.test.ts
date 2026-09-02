// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToday } from "$src/client/today"
import { requestSyncToken } from "$src/client/sync"
import { appendEntries, readLog } from "$src/logStore"
import {
	LOG_SCHEMA_VERSION,
	type StrengthEntry,
	type WellnessEntry,
} from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

/** Monday: the weekly plan schedules strength-a. */
const MONDAY = "2026-08-17"
const SUNDAY = "2026-08-16"
/** Tuesday: the weekly plan schedules Cardio, a conditioning day. */
const TUESDAY = "2026-08-18"
const LAST_SESSION = "2026-08-10"

/** Complete, so the dialog opens fully prefilled and submits as-is. */
const LAST_MONDAY: [ref: string, sets: number, kg: number, reps: number][] = [
	["back-squat", 3, 60, 8],
	["bench-press", 3, 40, 8],
	["barbell-row", 3, 30, 10],
	["romanian-deadlift", 2, 50, 10],
	["plank", 2, 0, 45],
]

async function seed(): Promise<void> {
	const entries: StrengthEntry[] = []
	for (const [ref, sets, kg, reps] of LAST_MONDAY)
		for (let set = 1; set <= sets; set++)
			entries.push({
				kind: "strength",
				schemaVersion: LOG_SCHEMA_VERSION,
				id: crypto.randomUUID(),
				date: LAST_SESSION,
				session: "strength-a",
				ref,
				set,
				kg,
				reps,
				rir: 2,
				unit: ref === "plank" ? "s" : "reps",
			})
	await appendEntries(entries)
}

const seedWellness = (metrics: { sleepHours?: number; steps?: number }) =>
	appendEntries([
		{
			kind: "wellness",
			schemaVersion: LOG_SCHEMA_VERSION,
			id: crypto.randomUUID(),
			date: SUNDAY,
			...metrics,
		},
	])

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

const submitButton = (dialog: HTMLDialogElement) =>
	dialog.querySelector<HTMLButtonElement>("button[type=submit]")!

/** Told apart from the sync login dialog by its fieldsets. */
const logDialogIn = (root: HTMLElement) =>
	[...root.querySelectorAll("dialog")].find((dialog) =>
		dialog.querySelector("fieldset"),
	)!

const openTrigger = (root: HTMLElement) =>
	[...root.querySelectorAll("button")].find(
		(button) => !button.closest("dialog"),
	)!

function removeAllSets(dialog: HTMLDialogElement): void {
	for (;;) {
		const remove = dialog.querySelector<HTMLButtonElement>(".set-remove")
		if (!remove) break
		remove.click()
	}
}

const sleepInput = (scope: ParentNode) =>
	scope.querySelector<HTMLInputElement>(".wellness-sleep")
const sleepMinutesInput = (scope: ParentNode) =>
	scope.querySelector<HTMLInputElement>(".wellness-sleep-minutes")
const stepsInput = (scope: ParentNode) =>
	scope.querySelector<HTMLInputElement>(".wellness-steps")

const legendsIn = (scope: ParentNode) =>
	[...scope.querySelectorAll("legend")].map((legend) => legend.textContent)

const alertsIn = (root: ParentNode) =>
	[...root.querySelectorAll("[role=alert]")]
		.map((node) => node.textContent)
		.join(" ")

async function render(): Promise<{
	root: HTMLElement
	dialog: HTMLDialogElement
}> {
	const root = document.createElement("div")
	// Connected: a detached form never submits.
	document.body.replaceChildren(root)
	await renderToday(root)
	return { root, dialog: logDialogIn(root) }
}

async function wellnessLogged(): Promise<WellnessEntry[]> {
	return (await readLog()).filter(
		(entry): entry is WellnessEntry => entry.kind === "wellness",
	)
}

beforeEach(async () => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
	// A device with sync already on, so "Log session" opens the form directly.
	vi.stubGlobal("fetch", async () => Response.json({ token: "tok" }))
	await requestSyncToken("secret")
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
	// Fake only Date so IndexedDB's real timers still run.
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(new Date(`${MONDAY}T10:00:00Z`))
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe("in the strength log dialog", () => {
	beforeEach(() => seed())

	it("offers yesterday's sleep and steps, named by date", async () => {
		const { dialog } = await render()

		expect(legendsIn(dialog)).toContain("Yesterday — Sun 16 Aug")
		expect(sleepInput(dialog)).not.toBeNull()
		expect(stepsInput(dialog)).not.toBeNull()
	})

	it("logs sleep and steps for yesterday alongside the session", async () => {
		const { root, dialog } = await render()
		openTrigger(root).click()
		sleepInput(dialog)!.value = "7"
		sleepMinutesInput(dialog)!.value = "30"
		stepsInput(dialog)!.value = "8432"
		submitButton(dialog).click()
		await settle()

		expect(await wellnessLogged()).toEqual([
			expect.objectContaining({ date: SUNDAY, sleepHours: 7.5, steps: 8432 }),
		])
		const strength = (await readLog()).filter(
			(entry) => entry.kind === "strength" && entry.date === MONDAY,
		)
		expect(strength).toHaveLength(13)
	})

	it("takes the minutes alone as a fraction of an hour", async () => {
		const { root, dialog } = await render()
		openTrigger(root).click()
		sleepMinutesInput(dialog)!.value = "45"
		submitButton(dialog).click()
		await settle()

		expect(await wellnessLogged()).toEqual([
			expect.objectContaining({ date: SUNDAY, sleepHours: 0.75 }),
		])
	})

	it("reads a zero night as no answer, not as a value the log refuses", async () => {
		const { root, dialog } = await render()
		openTrigger(root).click()
		sleepInput(dialog)!.value = "0"
		submitButton(dialog).click()
		await settle()

		expect(await wellnessLogged()).toEqual([])
		const strength = (await readLog()).filter(
			(entry) => entry.kind === "strength" && entry.date === MONDAY,
		)
		expect(strength).toHaveLength(13)
	})

	it("logs nothing extra when both are left blank", async () => {
		const { root, dialog } = await render()
		openTrigger(root).click()
		submitButton(dialog).click()
		await settle()

		expect(await wellnessLogged()).toEqual([])
		expect(dialog.open).toBe(false)
	})

	it("logs the metrics alone when every set was removed", async () => {
		const { root, dialog } = await render()
		openTrigger(root).click()
		removeAllSets(dialog)
		sleepInput(dialog)!.value = "6"
		submitButton(dialog).click()
		await settle()

		expect(dialog.open).toBe(false)
		const logged = await wellnessLogged()
		expect(logged).toEqual([
			expect.objectContaining({ date: SUNDAY, sleepHours: 6 }),
		])
		expect(logged[0].steps).toBeUndefined()
		expect((await readLog()).filter((entry) => entry.date === MONDAY)).toEqual(
			[],
		)
	})

	it("still refuses a submission with nothing at all", async () => {
		const { root, dialog } = await render()
		openTrigger(root).click()
		removeAllSets(dialog)
		submitButton(dialog).click()
		await settle()

		expect(alertsIn(dialog)).toContain("Nothing to log")
		expect(dialog.open).toBe(true)
		expect(await wellnessLogged()).toEqual([])
	})

	it("points every field label at a control in the dialog", async () => {
		const { dialog } = await render()

		const labels = [...dialog.querySelectorAll("label[for]")]
		expect(labels.map((label) => label.textContent)).toContain(
			"Sleep (h / min)",
		)
		for (const label of labels)
			expect(
				dialog.querySelector(`input[id="${label.getAttribute("for")}"]`),
			).not.toBeNull()
	})

	it("hides a metric already logged for yesterday", async () => {
		await seedWellness({ sleepHours: 7 })
		const { dialog } = await render()

		expect(sleepInput(dialog)).toBeNull()
		expect(stepsInput(dialog)).not.toBeNull()
	})

	it("hides the whole block once both metrics are logged", async () => {
		await seedWellness({ sleepHours: 7, steps: 9000 })
		const { dialog } = await render()

		expect(legendsIn(dialog).join(" ")).not.toContain("Yesterday")
		expect(sleepInput(dialog)).toBeNull()
		expect(stepsInput(dialog)).toBeNull()
	})
})

describe("in the conditioning log dialog", () => {
	beforeEach(() => {
		vi.setSystemTime(new Date(`${TUESDAY}T10:00:00Z`))
	})

	it("rides along the workout, dated the previous day", async () => {
		const { root, dialog } = await render()
		expect(legendsIn(dialog)).toContain("Yesterday — Mon 17 Aug")

		openTrigger(root).click()
		dialog.querySelector<HTMLInputElement>(".level")!.value = "3"
		dialog.querySelector<HTMLInputElement>(".sets")!.value = "4"
		sleepInput(dialog)!.value = "8"
		stepsInput(dialog)!.value = "12000"
		submitButton(dialog).click()
		await settle()

		expect(await wellnessLogged()).toEqual([
			expect.objectContaining({ date: MONDAY, sleepHours: 8, steps: 12000 }),
		])
		expect(root.textContent).toContain("Done")
	})
})
