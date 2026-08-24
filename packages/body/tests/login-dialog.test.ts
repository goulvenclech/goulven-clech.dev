// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToday } from "$src/client/today"
import { syncToken } from "$src/client/sync"
import { memoryStorage } from "./memoryStorage"

/** Monday: the weekly plan schedules strength-a. */
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

describe("from the Today screen", () => {
	it("offers sync before the log form when no token is stored", async () => {
		const root = await render(renderToday)

		buttonLabelled(root, "Log session").click()

		expect(loginIn(root).open).toBe(true)
		expect(logFormIn(root)!.open).toBe(false)
	})

	it("forgets the typed password once the offer is dismissed", async () => {
		const root = await render(renderToday)
		buttonLabelled(root, "Log session").click()
		const login = loginIn(root)
		login.querySelector<HTMLInputElement>("#sync-password")!.value = "secret"

		buttonLabelled(login, "Cancel").click()

		expect(login.querySelector<HTMLInputElement>("#sync-password")!.value).toBe(
			"",
		)
		expect(login.open).toBe(false)
		expect(logFormIn(root)!.open).toBe(false)
	})

	it("keeps a wrong password in the dialog, with sync off", async () => {
		const root = await render(renderToday)
		buttonLabelled(root, "Log session").click()
		const login = loginIn(root)

		vi.stubGlobal("fetch", async () => Response.json({}, { status: 401 }))
		submitPassword(login, "wrong")
		await settle()

		expect(syncToken()).toBeNull()
		expect(alertsIn(login)).toContain("Wrong password")
		expect(login.open).toBe(true)
		expect(logFormIn(root)!.open).toBe(false)
	})

	it("re-renders after login; the stored token then opens the form directly", async () => {
		vi.stubGlobal("fetch", async (url: string) =>
			String(url).includes("/auth")
				? Response.json({ token: "tok" })
				: Response.json({ entries: [], cursor: 0, max: 0 }),
		)
		const root = await render(renderToday)
		buttonLabelled(root, "Log session").click()
		submitPassword(loginIn(root), "secret")
		await settle()

		expect(logFormIn(root)!.open).toBe(false)

		buttonLabelled(root, "Log session").click()

		expect(loginIn(root).open).toBe(false)
		expect(logFormIn(root)!.open).toBe(true)
	})
})
