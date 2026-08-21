// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToday } from "$src/client/today"
import { requestSyncToken } from "$src/client/sync"
import { appendEntries, readLog } from "$src/logStore"
import { LOG_SCHEMA_VERSION, type StrengthEntry } from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

/** Monday: the weekly plan schedules strength-a. */
const MONDAY = "2026-08-17"
const LAST_SESSION = "2026-08-10"

type SeededExercise = [
	ref: string,
	sets: number,
	kg: number,
	reps: number,
	unit: StrengthEntry["unit"],
]

/** Complete, so every field in the dialog starts prefilled. */
const LAST_MONDAY: SeededExercise[] = [
	["back-squat", 3, 60, 8, "reps"],
	["bench-press", 3, 40, 8, "reps"],
	["barbell-row", 3, 30, 10, "reps"],
	["romanian-deadlift", 2, 50, 10, "reps"],
	["plank", 2, 0, 45, "s"],
]

async function seed(exercises: SeededExercise[]): Promise<void> {
	const entries: StrengthEntry[] = []
	for (const [ref, sets, kg, reps, unit] of exercises)
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
				unit,
			})
	await appendEntries(entries)
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

/** The dialog's own submit button, not the one that opens it. */
const submitButton = (dialog: HTMLDialogElement) =>
	dialog.querySelector<HTMLButtonElement>("button[type=submit]")!

const cancelButton = (dialog: HTMLDialogElement) =>
	dialog.querySelector<HTMLButtonElement>("button.button-secondary")!

/** Told apart from the sync login dialog by its fieldsets. */
const logDialogIn = (root: HTMLElement) =>
	[...root.querySelectorAll("dialog")].find((dialog) =>
		dialog.querySelector("fieldset"),
	)!

const openTrigger = (root: HTMLElement) =>
	[...root.querySelectorAll("button")].find(
		(button) => !button.closest("dialog"),
	)!

const exercisesIn = (dialog: HTMLDialogElement) =>
	[...dialog.querySelectorAll("fieldset:not(.wellness) legend")].map(
		(legend) => legend.textContent,
	)

function fieldsetFor(dialog: HTMLDialogElement, name: string): HTMLElement {
	const fieldset = [...dialog.querySelectorAll("fieldset")].find(
		(candidate) => candidate.querySelector("legend")?.textContent === name,
	)
	if (!fieldset) throw new Error(`The dialog has no "${name}" fieldset`)
	return fieldset
}

const rowsFor = (dialog: HTMLDialogElement, name: string) => [
	...fieldsetFor(dialog, name).querySelectorAll<HTMLElement>(".set-row"),
]

const addSetTo = (dialog: HTMLDialogElement, name: string) =>
	fieldsetFor(dialog, name).querySelector<HTMLButtonElement>(".set-add")!

/** Each click drops a row, so the list has to be re-queried every time. */
function removeAllSets(dialog: HTMLDialogElement, name: string): void {
	for (let left = rowsFor(dialog, name).length; left > 0; left--)
		fieldIn(rowsFor(dialog, name)[0], ".set-remove").click()
	expect(rowsFor(dialog, name)).toHaveLength(0)
}

const fieldIn = (row: HTMLElement, field: string) =>
	row.querySelector<HTMLInputElement>(field)!

const numbering = (dialog: HTMLDialogElement, name: string) =>
	rowsFor(dialog, name).map((row) => [
		row.querySelector("p")!.textContent,
		fieldIn(row, ".set-kg").getAttribute("aria-label"),
		fieldIn(row, ".set-reps").getAttribute("aria-label"),
		fieldIn(row, ".set-rir").getAttribute("aria-label"),
		fieldIn(row, ".set-remove").getAttribute("aria-label"),
	])

const numbered = (position: number, unit = "reps") => [
	String(position),
	`Set ${position} load (kg)`,
	`Set ${position} ${unit}`,
	`Set ${position} reps in reserve`,
	`Remove set ${position}`,
]

const rowValues = (row: HTMLElement) =>
	[".set-kg", ".set-reps", ".set-rir"].map((field) => fieldIn(row, field).value)

/** Sorted: the log is stored by id. */
async function loggedToday(ref: string): Promise<StrengthEntry[]> {
	const log = await readLog()
	return log
		.filter(
			(entry): entry is StrengthEntry =>
				entry.kind === "strength" && entry.ref === ref && entry.date === MONDAY,
		)
		.sort((a, b) => a.set - b.set)
}

const alertsIn = (root: ParentNode) =>
	[...root.querySelectorAll("[role=alert]")]
		.map((node) => node.textContent)
		.join(" ")

async function renderMonday(): Promise<{
	root: HTMLElement
	dialog: HTMLDialogElement
}> {
	const root = document.createElement("div")
	// Connected: a detached form never submits.
	document.body.replaceChildren(root)
	await renderToday(root)
	return { root, dialog: logDialogIn(root) }
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

describe("the day's plan", () => {
	beforeEach(() => seed(LAST_MONDAY))

	it("presents the session read-only, with logging behind a closed dialog", async () => {
		const { root, dialog } = await renderMonday()

		expect(root.querySelectorAll("section.panel input")).toHaveLength(0)
		expect(root.textContent).toContain("Back squat")
		expect(root.textContent).toContain("62.5 kg × 5")
		expect(root.textContent).toContain("3 sets of 5–8")
		expect(dialog.open).toBe(false)
	})

	it("offers no way to log a session that is already logged", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		submitButton(dialog).click()
		await settle()

		const relogged = document.createElement("div")
		document.body.replaceChildren(relogged)
		await renderToday(relogged)

		expect(relogged.querySelector("fieldset")).toBeNull()
		expect(relogged.textContent).toContain("Done")
	})

	it("keeps offering the exercises a partly logged session has left", async () => {
		await appendEntries(
			[1, 2, 3].map((set) => ({
				kind: "strength" as const,
				schemaVersion: LOG_SCHEMA_VERSION,
				id: crypto.randomUUID(),
				date: MONDAY,
				session: "strength-a",
				ref: "back-squat",
				set,
				kg: 62.5,
				reps: 5,
				rir: 2,
				unit: "reps" as const,
			})),
		)
		const { root, dialog } = await renderMonday()

		expect(exercisesIn(dialog)).toEqual([
			"Bench press",
			"Barbell row",
			"Romanian deadlift",
			"Plank",
		])

		openTrigger(root).click()
		submitButton(dialog).click()
		await settle()

		// The locked exercise keeps its original three sets, not six.
		expect(await loggedToday("back-squat")).toHaveLength(3)
		expect(await loggedToday("bench-press")).toHaveLength(3)
	})
})

describe("the log dialog", () => {
	beforeEach(() => seed(LAST_MONDAY))

	it("opens prefilled with the targets, and last session's effort", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()

		expect(dialog.open).toBe(true)
		expect(rowValues(rowsFor(dialog, "Back squat")[0])).toEqual([
			"62.5",
			"5",
			"2",
		])
		// Manual exercise: prefilled from the last session, in its own unit.
		expect(rowValues(rowsFor(dialog, "Plank")[0])).toEqual(["0", "45", "2"])

		expect(numbering(dialog, "Back squat")).toEqual([
			numbered(1),
			numbered(2),
			numbered(3),
		])
		expect(numbering(dialog, "Plank")).toEqual([
			numbered(1, "seconds"),
			numbered(2, "seconds"),
		])
	})

	it("logs the whole session in one write when nothing is corrected", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		submitButton(dialog).click()
		await settle()

		const today = (await readLog()).filter((entry) => entry.date === MONDAY)
		expect(today).toHaveLength(13)
		expect(dialog.open).toBe(false)

		const squat = await loggedToday("back-squat")
		expect(squat.map((entry) => `${entry.kg}×${entry.reps}`)).toEqual([
			"62.5×5",
			"62.5×5",
			"62.5×5",
		])
		expect((await loggedToday("plank")).map((entry) => entry.unit)).toEqual([
			"s",
			"s",
		])
	})

	it("removes a set and closes the gap in the numbering", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		fieldIn(rowsFor(dialog, "Back squat")[1], ".set-remove").click()

		expect(numbering(dialog, "Back squat")).toEqual([numbered(1), numbered(2)])

		submitButton(dialog).click()
		await settle()
		expect((await loggedToday("back-squat")).map((entry) => entry.set)).toEqual(
			[1, 2],
		)
	})

	it("submits from the log button alone, never from a row control", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		const kinds = [...dialog.querySelectorAll("button")].map((button) =>
			button.getAttribute("type"),
		)

		expect(kinds.filter((kind) => kind === "submit")).toHaveLength(1)
		expect(kinds.every((kind) => kind === "button" || kind === "submit")).toBe(
			true,
		)
	})

	it("keeps focus on a neighbouring control after a removal", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		fieldIn(rowsFor(dialog, "Back squat")[1], ".set-remove").click()
		expect(document.activeElement).toBe(
			fieldIn(rowsFor(dialog, "Back squat")[1], ".set-remove"),
		)

		const rows = rowsFor(dialog, "Back squat")
		fieldIn(rows[rows.length - 1], ".set-remove").click()
		expect(document.activeElement).toBe(
			fieldIn(rowsFor(dialog, "Back squat")[0], ".set-remove"),
		)

		removeAllSets(dialog, "Back squat")
		expect(document.activeElement).toBe(addSetTo(dialog, "Back squat"))
	})

	it("adds a set that logs alongside the planned ones", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		addSetTo(dialog, "Back squat").click()

		expect(numbering(dialog, "Back squat")).toEqual([
			numbered(1),
			numbered(2),
			numbered(3),
			numbered(4),
		])

		submitButton(dialog).click()
		await settle()
		expect((await loggedToday("back-squat")).map((entry) => entry.set)).toEqual(
			[1, 2, 3, 4],
		)
	})

	it("corrects a set to what was actually done", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		fieldIn(rowsFor(dialog, "Back squat")[2], ".set-reps").value = "3"
		submitButton(dialog).click()
		await settle()

		expect(
			(await loggedToday("back-squat")).map((entry) => entry.reps),
		).toEqual([5, 5, 3])
	})

	it("refuses to log a half-cleared set, naming the exercise", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		fieldIn(rowsFor(dialog, "Back squat")[0], ".set-rir").value = ""
		submitButton(dialog).click()
		await settle()

		expect(alertsIn(dialog)).toContain("Back squat")
		expect(dialog.open).toBe(true)
		expect(await readLog()).toHaveLength(13)
	})

	it("forgets a past failure when the dialog is reopened", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		fieldIn(rowsFor(dialog, "Back squat")[0], ".set-rir").value = ""
		submitButton(dialog).click()
		await settle()
		expect(alertsIn(dialog)).toContain("Back squat")

		cancelButton(dialog).click()
		openTrigger(root).click()
		expect(dialog.open).toBe(true)

		expect(alertsIn(dialog)).toBe("")
	})

	it("writes nothing when every set is removed", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		for (const name of exercisesIn(dialog)) removeAllSets(dialog, name!)
		submitButton(dialog).click()
		await settle()

		expect(alertsIn(dialog)).toContain("Nothing to log")
		expect(await readLog()).toHaveLength(13)
	})
})

describe("a previous session shorter than today's plan", () => {
	// Set 3 of the back squat and set 2 of the plank were skipped last time.
	beforeEach(() =>
		seed([
			["back-squat", 2, 60, 8, "reps"],
			["bench-press", 3, 40, 8, "reps"],
			["barbell-row", 3, 30, 10, "reps"],
			["romanian-deadlift", 2, 50, 10, "reps"],
			["plank", 1, 0, 45, "s"],
		]),
	)

	it("still prefills the sets it never reached", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()

		// A hold target: last time did not clear every set at the top of the range.
		expect(rowValues(rowsFor(dialog, "Back squat")[2])).toEqual([
			"60",
			"8",
			"2",
		])
		expect(rowValues(rowsFor(dialog, "Plank")[1])).toEqual(["0", "45", "2"])
	})

	it("logs untouched, without demanding the effort it never saw", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		submitButton(dialog).click()
		await settle()

		expect(alertsIn(dialog)).toBe("")
		expect(await loggedToday("back-squat")).toHaveLength(3)
	})
})

describe("a previous session whose sets differ", () => {
	// Plank is manual: its rows prefill per set, with no target flattening them.
	beforeEach(async () => {
		await seed(LAST_MONDAY.filter(([ref]) => ref !== "plank"))
		await appendEntries(
			[30, 45].map((reps, index) => ({
				kind: "strength" as const,
				schemaVersion: LOG_SCHEMA_VERSION,
				id: crypto.randomUUID(),
				date: LAST_SESSION,
				session: "strength-a",
				ref: "plank",
				set: index + 1,
				kg: 0,
				reps,
				rir: 2,
				unit: "s" as const,
			})),
		)
	})

	it("seeds an added row from the last set, not the first", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		expect(rowValues(rowsFor(dialog, "Plank")[0])).toEqual(["0", "30", "2"])

		addSetTo(dialog, "Plank").click()

		const rows = rowsFor(dialog, "Plank")
		expect(rows).toHaveLength(3)
		expect(rowValues(rows[2])).toEqual(["0", "45", "2"])
	})
})

describe("a first-ever session", () => {
	it("seeds the reps from the plan and leaves the load to type", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()

		expect(rowValues(rowsFor(dialog, "Back squat")[0])).toEqual(["", "5", ""])
		expect(rowValues(rowsFor(dialog, "Barbell row")[0])).toEqual(["", "8", ""])
		// Plank declares no rep range, so there is nothing to fall back to.
		expect(rowValues(rowsFor(dialog, "Plank")[0])).toEqual(["", "", ""])
	})

	it("logs once the loads are typed", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		for (const name of [
			"Bench press",
			"Barbell row",
			"Romanian deadlift",
			"Plank",
		])
			removeAllSets(dialog, name)
		for (const row of rowsFor(dialog, "Back squat")) {
			fieldIn(row, ".set-kg").value = "60"
			fieldIn(row, ".set-rir").value = "3"
		}
		submitButton(dialog).click()
		await settle()

		expect((await loggedToday("back-squat")).map((entry) => entry.kg)).toEqual([
			60, 60, 60,
		])
	})
})

describe("when the day rolls over", () => {
	beforeEach(() => seed(LAST_MONDAY))

	it("discards a session submitted after midnight, and says so", async () => {
		const { root, dialog } = await renderMonday()
		openTrigger(root).click()
		expect(dialog.open).toBe(true)

		vi.setSystemTime(new Date("2026-08-18T07:00:00Z"))
		submitButton(dialog).click()
		await settle()

		expect(dialog.open).toBe(false)
		expect(
			(await readLog()).every((entry) => entry.date === LAST_SESSION),
		).toBe(true)
		expect(alertsIn(root)).toContain("nothing was saved")
	})

	it("refuses to open yesterday's plan, and re-renders the new day", async () => {
		const { root } = await renderMonday()

		vi.setSystemTime(new Date("2026-08-18T07:00:00Z"))
		openTrigger(root).click()
		await settle()

		expect(alertsIn(root)).toContain("The day changed")
		// Tuesday is a conditioning day: the strength plan is gone.
		expect(root.textContent).not.toContain("Back squat")
	})
})
