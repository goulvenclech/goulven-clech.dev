// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { renderStats } from "$src/client/stats"
import { appendEntries } from "$src/logStore"
import type { StrengthEntry, WellnessEntry } from "$src/schemas"

const wellness = (
	date: string,
	metrics: { sleepHours?: number; steps?: number; weightKg?: number },
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

it("groups sleep, steps and weight under one wellness heading, before the 1RM", async () => {
	const root = document.createElement("div")
	document.body.replaceChildren(root)
	await renderStats(root)

	expect([...root.querySelectorAll("h2")].map((h) => h.textContent)).toEqual([
		"Adherence",
		"Wellness",
		"Estimated 1RM (Epley)",
		"Weekly tonnage",
	])
	expect(root.querySelector("section.panel p:last-child")?.textContent).toMatch(
		/^\d+ of the last \d+ scheduled sessions$/,
	)

	const wellness = [...root.querySelectorAll("h2")].find(
		(heading) => heading.textContent === "Wellness",
	)!.nextElementSibling!
	expect(wellness.textContent).toContain("No sleep logged yet.")
	expect(wellness.textContent).toContain("No steps logged yet.")
	expect(wellness.textContent).toContain("No weight logged yet.")
})

it("frames weight on a 4 kg window around the weigh-ins, headed by the last", async () => {
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(new Date("2026-08-19T10:00:00Z"))
	await appendEntries([
		wellness("2026-08-14", { weightKg: 71.5 }),
		wellness("2026-08-19", { weightKg: 72.5 }),
	])

	const root = document.createElement("div")
	document.body.replaceChildren(root)
	await renderStats(root, false)

	expect(chartPath(root, "Body weight")).toBe("M256.9 38.5 L282.0 25.5")
	expect(
		panelOf(root, "Body weight")?.querySelector("p.numeric")?.textContent,
	).toBe("72.5 kg")
	expect(panelOf(root, "Body weight")?.textContent).toContain(
		"weighed in on Wed 19 Aug",
	)
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
