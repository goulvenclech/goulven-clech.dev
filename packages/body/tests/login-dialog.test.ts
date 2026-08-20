// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHistory } from "$src/client/history"
import { renderToday } from "$src/client/today"
import { syncToken } from "$src/client/sync"
import { appendEntries } from "$src/logStore"
import { LOG_SCHEMA_VERSION, type StrengthEntry } from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

/** Monday: the weekly plan schedules Strength A. */
const MONDAY = "2026-08-17T10:00:00Z"

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

const dialogWith = (root: HTMLElement, selector: string) =>
	[...root.querySelectorAll("dialog")].find((dialog) =>
		dialog.querySelector(selector),
	)

const loginIn = (root: HTMLElement) => dialogWith(root, "#sync-password")!
const logFormIn = (root: HTMLElement) => dialogWith(root, "fieldset")

const buttonLabelled = (root: ParentNode, label: string) =>
	[...root.querySelectorAll("button")].find(
		(button) => button.textContent === label,
	)!

function submitPassword(login: HTMLDialogElement, password: string): void {
	login.querySelector<HTMLInputElement>("#sync-password")!.value = password
	login.querySelector<HTMLButtonElement>("button[type=submit]")!.click()
}

const alertsIn = (root: ParentNode) =>
	[...root.querySelectorAll("[role=alert]")]
		.map((node) => node.textContent)
		.join(" ")

async function render(
	view: (root: HTMLElement) => Promise<void>,
): Promise<HTMLElement> {
	const root = document.createElement("div")
	// Connected: a detached form never submits.
	document.body.replaceChildren(root)
	await view(root)
	return root
}

/** One logged set, so History has something to push and a toolbar to show. */
async function seedOneSet(): Promise<void> {
	const entry: StrengthEntry = {
		kind: "strength",
		schemaVersion: LOG_SCHEMA_VERSION,
		id: crypto.randomUUID(),
		date: "2026-08-10",
		session: "strength-a",
		ref: "back-squat",
		set: 1,
		kg: 60,
		reps: 8,
		rir: 2,
		unit: "reps",
	}
	await appendEntries([entry])
}

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
	// Fake only Date so IndexedDB's real timers still run.
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(new Date(MONDAY))
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe("from History", () => {
	beforeEach(seedOneSet)

	it("asks for the password in a dialog, not in the toolbar", async () => {
		const root = await render(renderHistory)

		const fields = [...root.querySelectorAll("input[type=password]")]
		expect(fields).toHaveLength(1)
		expect(fields[0].closest("dialog")).not.toBeNull()
		expect(loginIn(root).open).toBe(false)

		buttonLabelled(root, "Enable sync").click()
		expect(loginIn(root).open).toBe(true)
	})

	it("stores the token and turns sync on", async () => {
		const root = await render(renderHistory)
		buttonLabelled(root, "Enable sync").click()

		vi.stubGlobal("fetch", async (url: string) =>
			String(url).includes("/auth")
				? Response.json({ token: "tok" })
				: Response.json({ entries: [], cursor: 0, max: 0 }),
		)
		submitPassword(loginIn(root), "secret")
		await settle()

		expect(syncToken()).toBe("tok")
		expect(root.textContent).toContain("Sync on")
	})

	it("keeps a wrong password in the dialog, with sync off", async () => {
		const root = await render(renderHistory)
		buttonLabelled(root, "Enable sync").click()
		const login = loginIn(root)

		vi.stubGlobal("fetch", async () => Response.json({}, { status: 401 }))
		submitPassword(login, "wrong")
		await settle()

		expect(syncToken()).toBeNull()
		expect(alertsIn(login)).toContain("Wrong password")
		expect(login.open).toBe(true)
	})

	it("forgets the typed password once dismissed", async () => {
		const root = await render(renderHistory)
		buttonLabelled(root, "Enable sync").click()
		const login = loginIn(root)
		login.querySelector<HTMLInputElement>("#sync-password")!.value = "secret"

		buttonLabelled(login, "Cancel").click()

		expect(login.querySelector<HTMLInputElement>("#sync-password")!.value).toBe(
			"",
		)
		expect(login.open).toBe(false)
	})
})

describe("from the Today screen", () => {
	it("offers sync before the log form when no token is stored", async () => {
		const root = await render(renderToday)

		buttonLabelled(root, "Log session").click()

		expect(loginIn(root).open).toBe(true)
		expect(logFormIn(root)!.open).toBe(false)
	})

	it("still opens the log form when the offer is dismissed", async () => {
		const root = await render(renderToday)
		buttonLabelled(root, "Log session").click()

		buttonLabelled(loginIn(root), "Cancel").click()

		expect(loginIn(root).open).toBe(false)
		expect(logFormIn(root)!.open).toBe(true)
	})

	it("opens the log form directly once a token is stored", async () => {
		vi.stubGlobal("fetch", async (url: string) =>
			String(url).includes("/auth")
				? Response.json({ token: "tok" })
				: Response.json({ entries: [], cursor: 0, max: 0 }),
		)
		const root = await render(renderToday)
		buttonLabelled(root, "Log session").click()
		submitPassword(loginIn(root), "secret")
		await settle()

		expect(logFormIn(root)!.open).toBe(true)

		const next = await render(renderToday)
		buttonLabelled(next, "Log session").click()

		expect(loginIn(next).open).toBe(false)
		expect(logFormIn(next)!.open).toBe(true)
	})
})
