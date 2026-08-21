// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToday } from "$src/client/today"
import { LOG_SCHEMA_VERSION, type StrengthEntry } from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

/**
 * The mandatory sync gate makes login-then-log the onboarding path: the
 * login's own `await sync()` pulls the full history, so the view (and the
 * log form built from the pre-pull, empty log) must be rebuilt.
 */

/** Monday: the weekly plan schedules strength-a. */
const MONDAY = "2026-08-17T10:00:00Z"

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

const buttonLabelled = (root: ParentNode, label: string) =>
	[...root.querySelectorAll("button")].find(
		(button) => button.textContent === label,
	)!

const loginIn = (root: HTMLElement) =>
	[...root.querySelectorAll("dialog")].find((dialog) =>
		dialog.querySelector("#sync-password"),
	)!

/** The previous Monday's back-squat: 60 kg × 8 → today's target is 60 kg × 8. */
const PULLED: StrengthEntry = {
	kind: "strength",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: "11111111-1111-4111-8111-111111111111",
	date: "2026-08-10",
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg: 60,
	reps: 8,
	rir: 2,
	unit: "reps",
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

describe("first login from the Today gate", () => {
	it("shows the pulled targets, not the pre-pull first-time state", async () => {
		const root = document.createElement("div")
		// Connected: a detached form never submits.
		document.body.replaceChildren(root)
		await renderToday(root)

		expect(root.textContent).toContain("First time — pick a starting load")
		expect(root.textContent).not.toContain("60 kg × 8")

		buttonLabelled(root, "Log session").click()
		vi.stubGlobal("fetch", async (url: string) =>
			String(url).includes("/auth")
				? Response.json({ token: "tok" })
				: Response.json({ entries: [PULLED], cursor: 1, max: 1 }),
		)
		const login = loginIn(root)
		login.querySelector<HTMLInputElement>("#sync-password")!.value = "secret"
		login.querySelector<HTMLButtonElement>("button[type=submit]")!.click()
		await settle()

		expect(root.textContent).toContain("60 kg × 8")

		buttonLabelled(root, "Log session").click()
		const openForm = [...root.querySelectorAll("dialog")].find(
			(dialog) => dialog.open && dialog.querySelector(".set-kg"),
		)!
		expect(openForm.querySelector<HTMLInputElement>(".set-kg")!.value).toBe(
			"60",
		)
	})
})
