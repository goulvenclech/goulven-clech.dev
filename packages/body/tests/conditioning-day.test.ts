// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { renderToday } from "$src/client/today"
import { requestSyncToken } from "$src/client/sync"
import { appendEntries, readLog } from "$src/logStore"
import { LOG_SCHEMA_VERSION } from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

/** Wednesday: the weekly plan schedules Combat. */
const WEDNESDAY = "2026-08-19"
const TUESDAY = "2026-08-18"

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

async function render(): Promise<HTMLElement> {
	const root = document.createElement("div")
	// Connected: a detached form never submits.
	document.body.replaceChildren(root)
	await renderToday(root)
	return root
}

/** Told apart from the sync login dialog by its workout input. */
const workoutDialogIn = (root: HTMLElement) =>
	[...root.querySelectorAll("dialog")].find((dialog) =>
		dialog.querySelector(".workout"),
	)!

const triggersIn = (root: HTMLElement) =>
	[...root.querySelectorAll("button")].filter(
		(button) => !button.closest("dialog"),
	)

const openTrigger = (root: HTMLElement) => triggersIn(root)[0]

/** Filled in full, so only the date guard can stop the write. */
function fillWorkout(dialog: HTMLDialogElement, workout = "combat"): void {
	dialog.querySelector<HTMLInputElement>(".workout")!.value = workout
	dialog.querySelector<HTMLInputElement>(".level")!.value = "3"
	dialog.querySelector<HTMLInputElement>(".sets")!.value = "4"
}

const submitButton = (dialog: HTMLDialogElement) =>
	dialog.querySelector<HTMLButtonElement>("button[type=submit]")!

const linksIn = (root: HTMLElement) =>
	[...root.querySelectorAll<HTMLAnchorElement>("section.panel a")].map(
		(anchor) => anchor.getAttribute("href"),
	)

const alertsIn = (root: ParentNode) =>
	[...root.querySelectorAll("[role=alert]")]
		.map((node) => node.textContent)
		.join(" ")

beforeEach(async () => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
	// A device with sync already on, so "Log workout" opens the form directly.
	vi.stubGlobal("fetch", async () => Response.json({ token: "tok" }))
	await requestSyncToken("secret")
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
	// Fake only Date so IndexedDB's real timers still run.
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(new Date(`${WEDNESDAY}T10:00:00Z`))
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

it("presents a single Darebee card, with logging behind a closed dialog", async () => {
	const root = await render()
	const dialog = workoutDialogIn(root)

	expect(root.querySelectorAll("section.panel")).toHaveLength(1)
	expect(root.querySelectorAll("section.panel input")).toHaveLength(0)
	expect(root.textContent).toContain("Darebee")
	expect(dialog.open).toBe(false)
})

it("points a cardio day at the cardio and HIIT filters", async () => {
	vi.setSystemTime(new Date("2026-08-22T10:00:00Z"))
	const root = await render()
	expect(linksIn(root)).toEqual([
		"https://darebee.com/workout.html#ty=cardio",
		"https://darebee.com/workout.html#ty=hiit",
	])
})

it("points a combat day at the combat filter", async () => {
	const root = await render()
	expect(linksIn(root)).toEqual(["https://darebee.com/workout.html#ty=combat"])
	for (const anchor of root.querySelectorAll("section.panel a"))
		expect(anchor.getAttribute("target")).toBe("_blank")
})

it("logs the workout and shows it as done", async () => {
	const root = await render()
	const dialog = workoutDialogIn(root)
	openTrigger(root).click()
	expect(dialog.open).toBe(true)

	fillWorkout(dialog)
	submitButton(dialog).click()
	await settle()

	expect(await readLog()).toEqual([
		expect.objectContaining({
			kind: "conditioning",
			date: WEDNESDAY,
			category: "Combat",
			workout: "combat",
			level: 3,
			sets: 4,
		}),
	])
	expect(root.textContent).toContain("Done")
	expect(root.querySelector(".workout")).toBeNull()
	expect(triggersIn(root).map((button) => button.textContent)).toEqual([
		"Log yesterday",
	])
})

it("offers nothing once the workout and yesterday are both logged", async () => {
	await appendEntries([
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
	const dialog = workoutDialogIn(root)
	openTrigger(root).click()
	fillWorkout(dialog)
	submitButton(dialog).click()
	await settle()

	expect(triggersIn(root)).toHaveLength(0)
})

it("keeps the plan's category when the workout is renamed", async () => {
	const root = await render()
	const dialog = workoutDialogIn(root)
	openTrigger(root).click()
	fillWorkout(dialog, "Ab Blaster")
	submitButton(dialog).click()
	await settle()

	expect(await readLog()).toEqual([
		expect.objectContaining({ category: "Combat", workout: "Ab Blaster" }),
	])
})

it("refuses a workout that is only whitespace", async () => {
	const root = await render()
	const dialog = workoutDialogIn(root)
	openTrigger(root).click()
	// Native validation lets this through; the schema is what rejects it.
	fillWorkout(dialog, "   ")
	submitButton(dialog).click()
	await settle()

	expect(await readLog()).toEqual([])
	expect(dialog.open).toBe(true)
	expect(alertsIn(dialog)).toContain("check the workout")
})

it("still reports a failed save after the dialog was dismissed mid-write", async () => {
	const root = await render()
	const dialog = workoutDialogIn(root)
	openTrigger(root).click()
	fillWorkout(dialog, "   ")
	submitButton(dialog).click()
	// Cancel's synchronous click lands before the rejection's microtask, so
	// the save fails against a dialog that can no longer carry the news.
	dialog.querySelector<HTMLButtonElement>("button.button-secondary")!.click()
	expect(dialog.open).toBe(false)
	await settle()

	expect(await readLog()).toEqual([])
	const pageAlert = [...root.querySelectorAll("[role=alert]")].find(
		(node) => !node.closest("dialog"),
	)
	expect(pageAlert?.textContent).toContain("Could not save")
})

it("discards a workout submitted after midnight, and says so", async () => {
	const root = await render()
	const dialog = workoutDialogIn(root)
	openTrigger(root).click()
	fillWorkout(dialog)

	vi.setSystemTime(new Date("2026-08-20T07:00:00Z"))
	submitButton(dialog).click()
	await settle()

	expect(await readLog()).toEqual([])
	expect(alertsIn(root)).toContain("nothing was saved")
	// Thursday is a rest day.
	expect(root.querySelector(".workout")).toBeNull()
	expect(root.textContent).toContain("Nothing to log today")
})
