// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { renderToday } from "$src/client/today"
import { requestSyncToken } from "$src/client/sync"
import { readLog } from "$src/logStore"
import { memoryStorage } from "./memoryStorage"

/** Thursday: the weekly plan schedules Core, a conditioning day. */
const THURSDAY = "2026-08-20"

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
		dialog.querySelector("#workout"),
	)!

const openTrigger = (root: HTMLElement) =>
	[...root.querySelectorAll("button")].find(
		(button) => !button.closest("dialog"),
	)!

/** Filled in full, so only the date guard can stop the write. */
function fillWorkout(dialog: HTMLDialogElement, workout = "core"): void {
	dialog.querySelector<HTMLInputElement>("#workout")!.value = workout
	dialog.querySelector<HTMLInputElement>("#level")!.value = "3"
	dialog.querySelector<HTMLInputElement>("#sets")!.value = "4"
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
	vi.setSystemTime(new Date(`${THURSDAY}T10:00:00Z`))
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

it("points a core day at the Darebee core search", async () => {
	const root = await render()
	expect(linksIn(root)).toEqual(["https://darebee.com/workout.html#q=core"])
	for (const anchor of root.querySelectorAll("section.panel a"))
		expect(anchor.getAttribute("target")).toBe("_blank")
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
	vi.setSystemTime(new Date("2026-08-19T10:00:00Z"))
	const root = await render()
	expect(linksIn(root)).toEqual(["https://darebee.com/workout.html#ty=combat"])
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
			date: THURSDAY,
			category: "Core",
			workout: "core",
			level: 3,
			sets: 4,
		}),
	])
	expect(root.textContent).toContain("Done")
	// Logged days offer no second write.
	expect(
		[...root.querySelectorAll("button")].filter(
			(button) => !button.closest("dialog"),
		),
	).toHaveLength(0)
})

it("keeps the plan's category when the workout is renamed", async () => {
	const root = await render()
	const dialog = workoutDialogIn(root)
	openTrigger(root).click()
	fillWorkout(dialog, "Ab Blaster")
	submitButton(dialog).click()
	await settle()

	expect(await readLog()).toEqual([
		expect.objectContaining({ category: "Core", workout: "Ab Blaster" }),
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

	vi.setSystemTime(new Date("2026-08-21T07:00:00Z"))
	submitButton(dialog).click()
	await settle()

	expect(await readLog()).toEqual([])
	expect(alertsIn(root)).toContain("nothing was saved")
	// Friday is a strength day: the conditioning dialog is gone.
	expect(root.querySelector("#workout")).toBeNull()
})
