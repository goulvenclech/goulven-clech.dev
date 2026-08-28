// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { renderStats } from "$src/client/stats"
import { appendEntries } from "$src/logStore"
import type { StrengthEntry, WellnessEntry } from "$src/schemas"
import { ADHERENCE_DAYS, TREND_WEEKS, WELLNESS_DAYS } from "$src/stats"

const wellness = (
	date: string,
	metrics: { sleepHours?: number; steps?: number },
): WellnessEntry => ({
	kind: "wellness",
	schemaVersion: 1,
	id: crypto.randomUUID(),
	date,
	...metrics,
})

const strength = (date: string, kg: number): StrengthEntry => ({
	kind: "strength",
	schemaVersion: 1,
	id: crypto.randomUUID(),
	date,
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg,
	reps: 5,
	rir: 2,
	unit: "reps",
})

const chart = (root: HTMLElement, label: string) =>
	root.querySelector(`svg[aria-label^="${label}"]`)

const chartPath = (
	root: HTMLElement,
	label: string,
): string | null | undefined =>
	chart(root, label)?.querySelector("path")?.getAttribute("d")

const panelOf = (root: HTMLElement, label: string) =>
	chart(root, label)?.closest("section")

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.useRealTimers()
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

it("frames wellness on 5–9 h and 5000–9000 steps, captioned per metric", async () => {
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(new Date("2026-08-19T10:00:00Z"))
	await appendEntries([
		wellness("2026-08-17", { sleepHours: 6, steps: 6000 }),
		wellness("2026-08-18", { sleepHours: 7, steps: 7000 }),
	])

	const root = document.createElement("div")
	document.body.replaceChildren(root)
	await renderStats(root, false)

	expect(chartPath(root, "Sleep")).toBe("M271.8 45.0 L282.0 32.0")
	expect(chartPath(root, "Steps")).toBe("M271.8 45.0 L282.0 32.0")

	expect(panelOf(root, "Sleep")?.textContent).toContain(
		"average sleep per night",
	)
	expect(panelOf(root, "Steps")?.textContent).toContain("average steps per day")
	expect(panelOf(root, "Sleep")?.querySelector("p.numeric")?.textContent).toBe(
		"6 h 30",
	)
	expect(panelOf(root, "Steps")?.querySelector("p.numeric")?.textContent).toBe(
		"6500",
	)
})

it("leaves the 1RM trend on its own scale", async () => {
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(new Date("2026-08-19T10:00:00Z"))
	await appendEntries([strength("2026-08-12", 75), strength("2026-08-19", 80)])

	const root = document.createElement("div")
	document.body.replaceChildren(root)
	await renderStats(root, false)

	expect(chartPath(root, "Estimated one-rep max")).toBe(
		"M256.9 58.0 L282.0 6.0",
	)
})
