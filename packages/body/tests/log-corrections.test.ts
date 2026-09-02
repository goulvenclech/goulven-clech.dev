// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderLog } from "$src/client/log"
import { retractionOf } from "$src/corrections"
import {
	appendEntries,
	mergeEntries,
	outboxEntries,
	pendingCount,
	readLog,
} from "$src/logStore"
import {
	LOG_SCHEMA_VERSION,
	type ConditioningEntry,
	type RetractionEntry,
	type SkippedEntry,
	type StrengthEntry,
	type WellnessEntry,
} from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

/** Tuesday: the weekly plan schedules Cardio, after Monday's strength-a. */
const TUESDAY = "2026-08-18"
const MONDAY = "2026-08-17"
/** Wednesday: Combat. Thursday: the plan's midweek day off. */
const WEDNESDAY = "2026-08-19"
const THURSDAY = "2026-08-20"
const LAST_MONDAY = "2026-08-10"

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

const strengthSet = (
	date: string,
	set: number,
	kg: number,
	reps: number,
	ref = "back-squat",
): StrengthEntry => ({
	kind: "strength",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: crypto.randomUUID(),
	date,
	session: "strength-a",
	ref,
	set,
	kg,
	reps,
	rir: 2,
	unit: "reps",
})

const workout = (
	date: string,
	category = "Cardio",
	level = 3,
): ConditioningEntry => ({
	kind: "conditioning",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: crypto.randomUUID(),
	date,
	category,
	workout: category.toLowerCase(),
	level,
	sets: 5,
})

const skippedEntry = (
	date: string,
	planned: string,
	reason?: string,
): SkippedEntry => ({
	kind: "skipped",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: crypto.randomUUID(),
	date,
	planned,
	...(reason === undefined ? {} : { reason }),
})

async function seedHistory(): Promise<void> {
	const exercises: [string, number, number, number, StrengthEntry["unit"]][] = [
		["back-squat", 3, 60, 8, "reps"],
		["bench-press", 3, 40, 8, "reps"],
		["barbell-row", 3, 30, 10, "reps"],
		["romanian-deadlift", 2, 50, 10, "reps"],
		["plank", 2, 0, 45, "s"],
	]
	await appendEntries(
		exercises.flatMap(([ref, sets, kg, reps, unit]) =>
			Array.from({ length: sets }, (_, index) => ({
				...strengthSet(LAST_MONDAY, index + 1, kg, reps, ref),
				unit,
			})),
		),
	)
}

async function render(): Promise<HTMLElement> {
	const root = document.createElement("div")
	// Connected: a detached form never submits.
	document.body.replaceChildren(root)
	await renderLog(root, false)
	return root
}

function cardFor(root: HTMLElement, day: string): HTMLElement {
	const card = [...root.querySelectorAll<HTMLElement>("li.panel")].find(
		(candidate) => candidate.querySelector("p")?.textContent === day,
	)
	if (!card) throw new Error(`No card for ${day}`)
	return card
}

const typeOf = (card: HTMLElement) =>
	[...card.querySelector("div")!.querySelectorAll("p")][1].textContent

const linesOf = (card: HTMLElement) =>
	[...card.children]
		.filter((child) => child.tagName === "P")
		.map((line) => line.textContent)
		.join("\n")

const actionsIn = (card: HTMLElement) =>
	[...card.querySelectorAll("button")].filter(
		(button) => !button.closest("dialog"),
	)

const labelsIn = (card: HTMLElement) =>
	actionsIn(card).map((button) => button.textContent)

const buttonIn = (card: HTMLElement, label: string) =>
	actionsIn(card).find((button) => button.textContent === label) ?? null

function openCorrection(
	root: HTMLElement,
	day: string,
	label: string,
): HTMLDialogElement {
	const card = cardFor(root, day)
	buttonIn(card, label)!.click()
	return card.querySelector("dialog[open]")!
}

const submitButton = (dialog: HTMLDialogElement) =>
	dialog.querySelector<HTMLButtonElement>("button[type=submit]")!

const alertsIn = (root: ParentNode) =>
	[...root.querySelectorAll("[role=alert]")]
		.map((node) => node.textContent)
		.join(" ")

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

const fieldIn = (row: HTMLElement, field: string) =>
	row.querySelector<HTMLInputElement>(field)!

const rowValues = (row: HTMLElement) =>
	[".set-kg", ".set-reps", ".set-rir"].map((field) => fieldIn(row, field).value)

const inputIn = (dialog: HTMLDialogElement, field: string) =>
	dialog.querySelector<HTMLInputElement>(field)!

function removeAllSets(dialog: HTMLDialogElement, name: string): void {
	for (let left = rowsFor(dialog, name).length; left > 0; left--)
		fieldIn(rowsFor(dialog, name)[0], ".set-remove").click()
}

/** Sorted: the log is stored by id. */
async function strengthOn(
	date: string,
	ref = "back-squat",
): Promise<StrengthEntry[]> {
	const log = await readLog()
	return log
		.filter(
			(entry): entry is StrengthEntry =>
				entry.kind === "strength" && entry.date === date && entry.ref === ref,
		)
		.sort((a, b) => a.set - b.set)
}

/** Reads the outbox: the log itself hides retractions once applied. */
const retractions = async () =>
	(await outboxEntries()).filter(
		(entry): entry is RetractionEntry => entry.kind === "retraction",
	)

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
	localStorage.setItem("body-sync-token", "tok")
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
	// Fake only Date so IndexedDB's real timers still run.
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(new Date(`${TUESDAY}T10:00:00Z`))
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe("which days can be corrected", () => {
	it("offers today's workout and yesterday's session, nothing older", async () => {
		await appendEntries([
			strengthSet(MONDAY, 1, 60, 5),
			strengthSet(MONDAY, 2, 60, 5),
			workout(TUESDAY),
			strengthSet(LAST_MONDAY, 1, 55, 5),
		])
		const root = await render()

		expect(labelsIn(cardFor(root, "Tue 18 Aug"))).toEqual([
			"Edit workout",
			"Log wellness",
		])
		expect(labelsIn(cardFor(root, "Mon 17 Aug"))).toEqual([
			"Edit session",
			"Log wellness",
		])
		expect(labelsIn(cardFor(root, "Mon 10 Aug"))).toEqual([])
	})

	it("keeps the log read-only without the sync password", async () => {
		localStorage.removeItem("body-sync-token")
		await appendEntries([strengthSet(MONDAY, 1, 60, 5), workout(TUESDAY)])
		const root = await render()

		expect(root.querySelector("button")).toBeNull()
		expect(root.querySelector("dialog")).toBeNull()
	})

	it("offers to log a session the catch-up marked missed", async () => {
		await appendEntries([skippedEntry(MONDAY, "Strength")])
		const root = await render()

		expect(labelsIn(cardFor(root, "Mon 17 Aug"))).toEqual([
			"Log session",
			"Log wellness",
		])
	})

	it("lets a reasoned skip stand", async () => {
		await appendEntries([skippedEntry(MONDAY, "Strength", "ill")])
		const root = await render()

		expect(labelsIn(cardFor(root, "Mon 17 Aug"))).toEqual(["Log wellness"])
	})

	it("offers only wellness on a rest day", async () => {
		vi.setSystemTime(new Date(`${THURSDAY}T10:00:00Z`))
		await appendEntries([
			{
				kind: "wellness",
				schemaVersion: LOG_SCHEMA_VERSION,
				id: crypto.randomUUID(),
				date: THURSDAY,
				weightKg: 72,
			},
		])
		const root = await render()

		expect(labelsIn(cardFor(root, "Thu 20 Aug"))).toEqual(["Edit wellness"])
	})
})

describe("correcting a session", () => {
	beforeEach(() =>
		appendEntries([
			strengthSet(MONDAY, 1, 60, 5),
			strengthSet(MONDAY, 2, 62.5, 5),
			strengthSet(MONDAY, 1, 40, 8, "bench-press"),
		]),
	)

	it("reopens the exercises as logged, and the rest empty", async () => {
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")

		expect(dialog.open).toBe(true)
		expect(submitButton(dialog).textContent).toBe("Save session")
		expect(rowsFor(dialog, "Back squat").map(rowValues)).toEqual([
			["60", "5", "2"],
			["62.5", "5", "2"],
		])
		expect(rowsFor(dialog, "Bench press").map(rowValues)).toEqual([
			["40", "8", "2"],
		])
		expect(rowsFor(dialog, "Barbell row")).toEqual([])
	})

	it("rewrites a corrected exercise and withdraws what it replaces", async () => {
		const before = await strengthOn(MONDAY)
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")
		fieldIn(rowsFor(dialog, "Back squat")[1], ".set-reps").value = "3"
		submitButton(dialog).click()
		await settle()

		const after = await strengthOn(MONDAY)
		expect(after.map((entry) => `${entry.kg}×${entry.reps}`)).toEqual([
			"60×5",
			"62.5×3",
		])
		expect(after.map((entry) => entry.id)).not.toContain(before[0].id)
		expect((await retractions()).map((entry) => entry.retracts).sort()).toEqual(
			before.map((entry) => entry.id).sort(),
		)
		expect(dialog.open).toBe(false)
		expect(linesOf(cardFor(root, "Mon 17 Aug"))).toContain("62.5 kg × 3")
	})

	it("leaves an untouched exercise's entries as they are", async () => {
		const [bench] = await strengthOn(MONDAY, "bench-press")
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")
		fieldIn(rowsFor(dialog, "Back squat")[0], ".set-kg").value = "57.5"
		submitButton(dialog).click()
		await settle()

		expect(await strengthOn(MONDAY, "bench-press")).toEqual([bench])
		expect((await retractions()).map((entry) => entry.retracts)).not.toContain(
			bench.id,
		)
	})

	it("closes without a write when nothing changed", async () => {
		const before = await readLog()
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")
		submitButton(dialog).click()
		await settle()

		expect(dialog.open).toBe(false)
		expect(await readLog()).toEqual(before)
		expect(await pendingCount()).toBe(3)
	})

	it("drops an exercise whose every set is removed, keeping the others", async () => {
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")
		removeAllSets(dialog, "Bench press")
		submitButton(dialog).click()
		await settle()

		expect(await strengthOn(MONDAY, "bench-press")).toEqual([])
		expect(await strengthOn(MONDAY)).toHaveLength(2)
		expect(linesOf(cardFor(root, "Mon 17 Aug"))).not.toContain("Bench press")
	})

	it("refuses to clear the whole day", async () => {
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")
		removeAllSets(dialog, "Back squat")
		removeAllSets(dialog, "Bench press")
		submitButton(dialog).click()
		await settle()

		expect(dialog.open).toBe(true)
		expect(alertsIn(dialog)).toContain("every set was removed")
		expect(await strengthOn(MONDAY)).toHaveLength(2)
		expect(await retractions()).toEqual([])
	})

	it("seeds a set added to a logged exercise from its last set", async () => {
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")
		fieldsetFor(dialog, "Back squat")
			.querySelector<HTMLButtonElement>(".set-add")!
			.click()

		expect(rowValues(rowsFor(dialog, "Back squat")[2])).toEqual([
			"62.5",
			"5",
			"2",
		])
	})

	describe("when another device's correction lands while the form is open", () => {
		const landOtherCorrection = async () =>
			mergeEntries([
				...(await strengthOn(MONDAY)).map(retractionOf),
				strengthSet(MONDAY, 1, 60, 4),
				strengthSet(MONDAY, 2, 62.5, 4),
			])

		it("withdraws what stands at the write, not what the form opened with", async () => {
			const root = await render()
			const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")
			await landOtherCorrection()
			fieldIn(rowsFor(dialog, "Back squat")[1], ".set-reps").value = "3"
			submitButton(dialog).click()
			await settle()

			expect(
				(await strengthOn(MONDAY)).map((entry) => `${entry.kg}×${entry.reps}`),
			).toEqual(["60×5", "62.5×3"])
		})

		it("leaves that correction alone when the form is submitted untouched", async () => {
			const root = await render()
			const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")
			await landOtherCorrection()
			submitButton(dialog).click()
			await settle()

			expect((await strengthOn(MONDAY)).map((entry) => entry.reps)).toEqual([
				4, 4,
			])
			expect(await pendingCount()).toBe(3)
		})
	})
})

describe("a session logged under another template", () => {
	beforeEach(() =>
		appendEntries(
			[1, 2].map((set) => ({
				...strengthSet(MONDAY, set, 100, 5, "barbell-deadlift"),
				session: "strength-b",
			})),
		),
	)

	it("reopens as it was logged, not as the plan now reads", async () => {
		const before = await readLog()
		const root = await render()
		expect(labelsIn(cardFor(root, "Mon 17 Aug"))).toContain("Edit session")
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")

		expect(submitButton(dialog).textContent).toBe("Save session")
		expect(rowsFor(dialog, "Deadlift").map(rowValues)).toEqual([
			["100", "5", "2"],
			["100", "5", "2"],
		])

		submitButton(dialog).click()
		await settle()
		expect(await readLog()).toEqual(before)
	})
})

describe("a session whose template is gone", () => {
	beforeEach(() =>
		appendEntries([
			{
				...strengthSet(MONDAY, 1, 50, 10, "lat-pulldown"),
				session: "strength-z",
			},
		]),
	)

	it("still reopens the sets, alongside the plan's exercises left empty", async () => {
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")

		expect(rowsFor(dialog, "Lat pulldown").map(rowValues)).toEqual([
			["50", "10", "2"],
		])
		expect(rowsFor(dialog, "Back squat")).toEqual([])

		fieldIn(rowsFor(dialog, "Lat pulldown")[0], ".set-reps").value = "8"
		submitButton(dialog).click()
		await settle()

		expect(
			(await strengthOn(MONDAY, "lat-pulldown")).map((entry) => entry.reps),
		).toEqual([8])
		expect(await retractions()).toHaveLength(1)
	})
})

describe("logging a session the catch-up marked missed", () => {
	beforeEach(async () => {
		await seedHistory()
		await appendEntries([skippedEntry(MONDAY, "Strength")])
	})

	it("plans it as today's page would, and the log settles the mark", async () => {
		const root = await render()
		expect(linesOf(cardFor(root, "Mon 17 Aug"))).toContain("never logged")
		const dialog = openCorrection(root, "Mon 17 Aug", "Log session")

		expect(submitButton(dialog).textContent).toBe("Log session")
		expect(rowsFor(dialog, "Back squat").map(rowValues)).toEqual([
			["62.5", "5", "2"],
			["62.5", "5", "2"],
			["62.5", "5", "2"],
		])

		submitButton(dialog).click()
		await settle()

		expect(await strengthOn(MONDAY)).toHaveLength(3)
		const card = cardFor(root, "Mon 17 Aug")
		expect(typeOf(card)).toBe("Strength")
		expect(linesOf(card)).not.toContain("never logged")
		expect(await retractions()).toEqual([])
		expect(
			(await outboxEntries()).some((entry) => entry.kind === "skipped"),
		).toBe(true)
	})
})

describe("a workout", () => {
	it("reopens today's as logged, and withdraws it for the edit", async () => {
		const logged = workout(TUESDAY)
		await appendEntries([logged])
		const root = await render()
		const dialog = openCorrection(root, "Tue 18 Aug", "Edit workout")

		expect(submitButton(dialog).textContent).toBe("Save workout")
		expect(
			[".workout", ".level", ".sets"].map(
				(field) => inputIn(dialog, field).value,
			),
		).toEqual(["cardio", "3", "5"])

		inputIn(dialog, ".level").value = "4"
		submitButton(dialog).click()
		await settle()

		const live = (await readLog()).filter(
			(entry) => entry.kind === "conditioning",
		)
		expect(live).toEqual([
			expect.objectContaining({
				date: TUESDAY,
				category: "Cardio",
				workout: "cardio",
				level: 4,
				sets: 5,
			}),
		])
		expect(live[0].id).not.toBe(logged.id)
		expect((await retractions()).map((entry) => entry.retracts)).toEqual([
			logged.id,
		])
		expect(linesOf(cardFor(root, "Tue 18 Aug"))).toContain("level 4 · 5 sets")
	})

	it("logs yesterday's when the catch-up marked it missed", async () => {
		vi.setSystemTime(new Date(`${WEDNESDAY}T10:00:00Z`))
		await appendEntries([skippedEntry(TUESDAY, "Cardio")])
		const root = await render()
		const dialog = openCorrection(root, "Tue 18 Aug", "Log workout")

		expect(submitButton(dialog).textContent).toBe("Log workout")
		expect(inputIn(dialog, ".workout").value).toBe("cardio")

		inputIn(dialog, ".level").value = "3"
		inputIn(dialog, ".sets").value = "4"
		submitButton(dialog).click()
		await settle()

		expect(await readLog()).toContainEqual(
			expect.objectContaining({
				kind: "conditioning",
				date: TUESDAY,
				category: "Cardio",
				workout: "cardio",
				level: 3,
				sets: 4,
			}),
		)
		expect(linesOf(cardFor(root, "Tue 18 Aug"))).not.toContain("never logged")
	})

	it("closes without a write when nothing changed", async () => {
		await appendEntries([workout(TUESDAY)])
		const before = await readLog()
		const root = await render()
		const dialog = openCorrection(root, "Tue 18 Aug", "Edit workout")
		submitButton(dialog).click()
		await settle()

		expect(dialog.open).toBe(false)
		expect(await readLog()).toEqual(before)
		expect(await pendingCount()).toBe(1)
	})

	it("withdraws every workout standing that day, not just the first", async () => {
		const run = workout(TUESDAY)
		const bike = { ...workout(TUESDAY, "Cardio", 2), workout: "bike" }
		await appendEntries([run, bike])
		const root = await render()
		const card = cardFor(root, "Tue 18 Aug")
		expect(labelsIn(card)).toEqual(["Edit workout", "Log wellness"])
		const dialog = openCorrection(root, "Tue 18 Aug", "Edit workout")
		inputIn(dialog, ".level").value = "5"
		submitButton(dialog).click()
		await settle()

		const live = (await readLog()).filter(
			(entry) => entry.kind === "conditioning",
		)
		expect(live).toEqual([expect.objectContaining({ level: 5 })])
		expect((await retractions()).map((entry) => entry.retracts).sort()).toEqual(
			[run.id, bike.id].sort(),
		)
	})

	it("labels each day's fields as its own", async () => {
		vi.setSystemTime(new Date(`${WEDNESDAY}T10:00:00Z`))
		await appendEntries([workout(TUESDAY), workout(WEDNESDAY, "Combat")])
		const root = await render()
		const labels = [...root.querySelectorAll<HTMLLabelElement>("dialog label")]

		// Two cards, each a workout and a wellness dialog of three labelled fields.
		expect(labels).toHaveLength(12)
		for (const label of labels) {
			const target = document.getElementById(label.htmlFor)
			expect(target?.closest("dialog")).toBe(label.closest("dialog"))
		}
	})
})

describe("while the page's own sync lands", () => {
	it("keeps an open correction dialog, and what was typed in it", async () => {
		await appendEntries([strengthSet(MONDAY, 1, 60, 5)])
		const pulled = {
			kind: "wellness",
			schemaVersion: LOG_SCHEMA_VERSION,
			id: crypto.randomUUID(),
			date: "2026-08-16",
			weightKg: 72,
		}
		let release!: () => void
		const page = new Promise<void>((resolve) => (release = resolve))
		vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
			if (init?.method === "POST")
				return Response.json({ inserted: 1 }, { status: 201 })
			await page
			return Response.json({ entries: [pulled], cursor: 1, max: 1 })
		})
		const root = document.createElement("div")
		document.body.replaceChildren(root)
		await renderLog(root, true)
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")
		fieldIn(rowsFor(dialog, "Back squat")[0], ".set-reps").value = "3"

		release()
		await settle()

		expect(await pendingCount()).toBe(0)
		expect((await readLog()).some((entry) => entry.id === pulled.id)).toBe(true)
		expect(root.contains(dialog)).toBe(true)
		expect(dialog.open).toBe(true)
		expect(fieldIn(rowsFor(dialog, "Back squat")[0], ".set-reps").value).toBe(
			"3",
		)
	})
})

describe("when the page outlives its day", () => {
	beforeEach(() => appendEntries([strengthSet(MONDAY, 1, 60, 5)]))

	it("discards a correction submitted after midnight, and says so", async () => {
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit session")
		vi.setSystemTime(new Date(`${WEDNESDAY}T07:00:00Z`))
		fieldIn(rowsFor(dialog, "Back squat")[0], ".set-reps").value = "3"
		submitButton(dialog).click()
		await settle()

		expect(dialog.open).toBe(false)
		expect(alertsIn(root)).toContain("nothing was saved")
		expect((await strengthOn(MONDAY)).map((entry) => entry.reps)).toEqual([5])
	})

	it("refreshes rather than reopen a day that slipped out of reach", async () => {
		const root = await render()
		vi.setSystemTime(new Date(`${WEDNESDAY}T07:00:00Z`))
		buttonIn(cardFor(root, "Mon 17 Aug"), "Edit session")!.click()
		await settle()

		expect(alertsIn(root)).toContain("The day changed")
		expect(labelsIn(cardFor(root, "Mon 17 Aug"))).toEqual([])
	})
})

describe("wellness", () => {
	const weighIn = (date: string, weightKg: number): WellnessEntry => ({
		kind: "wellness",
		schemaVersion: LOG_SCHEMA_VERSION,
		id: crypto.randomUUID(),
		date,
		weightKg,
	})

	const night = (
		date: string,
		sleepHours: number,
		steps: number,
	): WellnessEntry => ({
		kind: "wellness",
		schemaVersion: LOG_SCHEMA_VERSION,
		id: crypto.randomUUID(),
		date,
		sleepHours,
		steps,
	})

	const wellnessInputs = (dialog: HTMLDialogElement) =>
		[
			".wellness-sleep",
			".wellness-sleep-minutes",
			".wellness-steps",
			".wellness-weight",
		].map((field) => inputIn(dialog, field).value)

	const wellnessOn = async (date: string) =>
		(await readLog()).filter(
			(entry): entry is WellnessEntry =>
				entry.kind === "wellness" && entry.date === date,
		)

	it("reopens the day's metrics, whichever entries carried them, as one", async () => {
		const scale = weighIn(MONDAY, 72)
		const sleep = night(MONDAY, 7.5, 4200)
		await appendEntries([scale, sleep])
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit wellness")

		expect(submitButton(dialog).textContent).toBe("Save wellness")
		expect(wellnessInputs(dialog)).toEqual(["7", "30", "4200", "72"])

		inputIn(dialog, ".wellness-steps").value = "5000"
		submitButton(dialog).click()
		await settle()

		expect(await wellnessOn(MONDAY)).toEqual([
			expect.objectContaining({ sleepHours: 7.5, steps: 5000, weightKg: 72 }),
		])
		expect((await retractions()).map((entry) => entry.retracts).sort()).toEqual(
			[scale.id, sleep.id].sort(),
		)
		expect(linesOf(cardFor(root, "Mon 17 Aug"))).toContain(
			"Wellness 7 h 30 sleep · 5000 steps · 72 kg body weight",
		)
	})

	it("closes without a write when nothing changed", async () => {
		await appendEntries([weighIn(MONDAY, 72), night(MONDAY, 7.5, 4200)])
		const before = await readLog()
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit wellness")
		submitButton(dialog).click()
		await settle()

		expect(dialog.open).toBe(false)
		expect(await readLog()).toEqual(before)
		expect(await pendingCount()).toBe(2)
	})

	it("refuses to clear the day's wellness", async () => {
		await appendEntries([weighIn(MONDAY, 72)])
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit wellness")
		inputIn(dialog, ".wellness-weight").value = ""
		submitButton(dialog).click()
		await settle()

		expect(dialog.open).toBe(true)
		expect(alertsIn(dialog)).toContain("Nothing to log")
		expect(await wellnessOn(MONDAY)).toHaveLength(1)
	})

	it("logs wellness on a day that had none", async () => {
		await appendEntries([skippedEntry(MONDAY, "Strength")])
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Log wellness")
		expect(submitButton(dialog).textContent).toBe("Log wellness")
		inputIn(dialog, ".wellness-weight").value = "71.2"
		submitButton(dialog).click()
		await settle()

		expect(await wellnessOn(MONDAY)).toEqual([
			{
				kind: "wellness",
				schemaVersion: LOG_SCHEMA_VERSION,
				id: expect.any(String),
				date: MONDAY,
				weightKg: 71.2,
			},
		])
		expect(await retractions()).toEqual([])
		expect(linesOf(cardFor(root, "Mon 17 Aug"))).toContain(
			"71.2 kg body weight",
		)
	})

	it("drops a metric left blank, keeping the others", async () => {
		await appendEntries([weighIn(MONDAY, 72), night(MONDAY, 7.5, 4200)])
		const root = await render()
		const dialog = openCorrection(root, "Mon 17 Aug", "Edit wellness")
		inputIn(dialog, ".wellness-steps").value = ""
		submitButton(dialog).click()
		await settle()

		const [merged] = await wellnessOn(MONDAY)
		expect(merged).toMatchObject({ sleepHours: 7.5, weightKg: 72 })
		expect(merged).not.toHaveProperty("steps")
		expect(await retractions()).toHaveLength(2)
	})
})
