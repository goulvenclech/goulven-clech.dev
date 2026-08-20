// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { renderToday } from "$src/client/today"
import { readLog } from "$src/logStore"

/** Thursday: the weekly plan schedules Core, a conditioning day. */
const THURSDAY = "2026-08-20"

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

async function renderThursday(): Promise<HTMLElement> {
	const root = document.createElement("div")
	// Connected: a detached form never submits.
	document.body.replaceChildren(root)
	await renderToday(root)
	return root
}

/** Filled in full, so only the date guard can stop the write. */
function fillWorkout(root: HTMLElement): void {
	root.querySelector<HTMLInputElement>("#workout")!.value = "core"
	root.querySelector<HTMLInputElement>("#level")!.value = "3"
	root.querySelector<HTMLInputElement>("#sets")!.value = "4"
}

const submit = (root: HTMLElement) =>
	root.querySelector<HTMLButtonElement>("form button")!.click()

const alertsIn = (root: ParentNode) =>
	[...root.querySelectorAll("[role=alert]")]
		.map((node) => node.textContent)
		.join(" ")

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
	// Fake only Date so IndexedDB's real timers still run.
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(new Date(`${THURSDAY}T10:00:00Z`))
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

it("logs the workout and shows it as done", async () => {
	const root = await renderThursday()
	fillWorkout(root)
	submit(root)
	await settle()

	expect(await readLog()).toEqual([
		expect.objectContaining({
			kind: "conditioning",
			date: THURSDAY,
			workout: "core",
			level: 3,
			sets: 4,
		}),
	])
	expect(root.textContent).toContain("Done")
})

it("discards a workout submitted after midnight, and says so", async () => {
	const root = await renderThursday()
	fillWorkout(root)

	vi.setSystemTime(new Date("2026-08-21T07:00:00Z"))
	submit(root)
	await settle()

	expect(await readLog()).toEqual([])
	expect(alertsIn(root)).toContain("nothing was saved")
	// Friday is a strength day: the conditioning form is gone.
	expect(root.querySelector("#workout")).toBeNull()
})
