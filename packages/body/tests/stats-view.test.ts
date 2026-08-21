// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { renderStats } from "$src/client/stats"
import { ADHERENCE_DAYS, TREND_WEEKS, WELLNESS_DAYS } from "$src/stats"

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
})

afterEach(() => {
	vi.unstubAllGlobals()
})

it("groups sleep and steps under one wellness heading, before the 1RM", async () => {
	const root = document.createElement("div")
	document.body.replaceChildren(root)
	await renderStats(root)

	expect([...root.querySelectorAll("h2")].map((h) => h.textContent)).toEqual([
		`Adherence — last ${ADHERENCE_DAYS} days`,
		`Wellness — last ${WELLNESS_DAYS} days`,
		`Estimated 1RM — ${TREND_WEEKS} weeks, Epley`,
		`Weekly tonnage — ${TREND_WEEKS} weeks`,
	])
	expect(root.textContent).toContain("No sleep logged yet.")
	expect(root.textContent).toContain("No steps logged yet.")
})
