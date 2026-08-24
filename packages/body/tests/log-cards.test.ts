// @vitest-environment happy-dom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { renderLog } from "$src/client/log"
import { appendEntries } from "$src/logStore"
import {
	LOG_SCHEMA_VERSION,
	type LogEntry,
	type StrengthEntry,
} from "$src/schemas"
import { memoryStorage } from "./memoryStorage"

/** The log comes back in id order: these seed a card in the wrong one. */
const IDS = [
	"11111111-1111-4111-8111-111111111111",
	"22222222-2222-4222-8222-222222222222",
	"33333333-3333-4333-8333-333333333333",
] as const

const strengthSet = (
	set: number,
	kg: number,
	reps: number,
	ref = "back-squat",
	id = crypto.randomUUID(),
): StrengthEntry => ({
	kind: "strength",
	schemaVersion: LOG_SCHEMA_VERSION,
	id,
	date: "2026-08-17",
	session: "strength-a",
	ref,
	set,
	kg,
	reps,
	rir: 2,
	unit: "reps",
})

const conditioning = (
	workout: string,
	category = "Core",
	id = crypto.randomUUID(),
): LogEntry => ({
	kind: "conditioning",
	schemaVersion: LOG_SCHEMA_VERSION,
	id,
	date: "2026-08-20",
	category,
	workout,
	level: 3,
	sets: 5,
})

const skippedEntry = (planned: string, reason?: string): LogEntry => ({
	kind: "skipped",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: crypto.randomUUID(),
	date: "2026-08-20",
	planned,
	...(reason === undefined ? {} : { reason }),
})

const headerOf = (card: HTMLElement) => [
	...card.querySelector("div")!.querySelectorAll("p"),
]

const dayOf = (card: HTMLElement) => headerOf(card)[0].textContent
const typeOf = (card: HTMLElement) => headerOf(card)[1].textContent
const typeClassOf = (card: HTMLElement) => headerOf(card)[1].className

const contentOf = (card: HTMLElement) =>
	[...card.children]
		.filter((child) => child.tagName === "P")
		.map((line) => line.textContent)

async function cardFor(date: string): Promise<HTMLElement> {
	const root = document.createElement("div")
	await renderLog(root, false)
	const card = [...root.querySelectorAll<HTMLElement>("li.panel")].find(
		(day) => dayOf(day) === date,
	)
	if (!card) throw new Error(`No card for ${date}`)
	return card
}

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("localStorage", memoryStorage())
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
})

afterEach(() => {
	vi.unstubAllGlobals()
})

it("types a conditioning day by its category, not its kind", async () => {
	await appendEntries([conditioning("Ab Blaster")])
	const card = await cardFor("Thu 20 Aug")

	expect(typeOf(card)).toBe("Core")
	expect(contentOf(card)).toEqual(["Ab Blaster level 3 · 5 sets"])
	expect(card.textContent).not.toContain("Conditioning")
})

it("keeps the type when the workout is a free-text sheet name", async () => {
	await appendEntries([conditioning("Gladiator", "Combat")])
	const card = await cardFor("Thu 20 Aug")

	expect(typeOf(card)).toBe("Combat")
	expect(contentOf(card)).toEqual(["Gladiator level 3 · 5 sets"])
})

it("names a strength day by its type, and lists the sets", async () => {
	await appendEntries([strengthSet(1, 60, 5), strengthSet(2, 62.5, 5)])
	const card = await cardFor("Mon 17 Aug")

	expect(typeOf(card)).toBe("Strength")
	expect(contentOf(card)).toEqual(["Back squat 60 kg × 5 · 62.5 kg × 5"])
})

it("lists every type a day holds, without repeating one", async () => {
	await appendEntries([
		conditioning("Iron Core", "Core", IDS[0]),
		conditioning("Ab Blaster", "Core", IDS[1]),
		conditioning("Gladiator", "Combat", IDS[2]),
	])
	const card = await cardFor("Thu 20 Aug")

	expect(typeOf(card)).toBe("Combat · Core")
	expect(contentOf(card)).toEqual([
		"Gladiator level 3 · 5 sets",
		"Ab Blaster level 3 · 5 sets",
		"Iron Core level 3 · 5 sets",
	])
})

// The expected order is the one in data/sessions/strength-a.json.
it("keeps a card's exercises in the order the session plans them", async () => {
	await appendEntries([
		strengthSet(1, 30, 10, "barbell-row", IDS[0]),
		strengthSet(1, 60, 5, "back-squat", IDS[1]),
		strengthSet(1, 40, 5, "bench-press", IDS[2]),
	])

	expect(contentOf(await cardFor("Mon 17 Aug"))).toEqual([
		"Back squat 60 kg × 5",
		"Bench press 40 kg × 5",
		"Barbell row 30 kg × 10",
	])
})

it("keeps an exercise's sets in order, and retired lifts last", async () => {
	await appendEntries([
		strengthSet(2, 62.5, 5, "back-squat", IDS[0]),
		// In the catalogue and in strength-b, but not in this day's template.
		strengthSet(1, 50, 10, "lat-pulldown", IDS[1]),
		strengthSet(1, 60, 5, "back-squat", IDS[2]),
	])

	expect(contentOf(await cardFor("Mon 17 Aug"))).toEqual([
		"Back squat 60 kg × 5 · 62.5 kg × 5",
		"Lat pulldown 50 kg × 10",
	])
})

it("types a rest day by its plan, muted like any other", async () => {
	await appendEntries([
		{
			kind: "wellness",
			schemaVersion: LOG_SCHEMA_VERSION,
			id: crypto.randomUUID(),
			// Sunday, the plan's day off.
			date: "2026-08-23",
			sleepHours: 7,
			steps: 4935,
		},
	])
	const card = await cardFor("Sun 23 Aug")

	expect(typeOf(card)).toBe("Rest")
	expect(typeClassOf(card)).not.toContain("text-primary")
})

it("types a skipped day in the primary colour, with the plan and the reason", async () => {
	await appendEntries([skippedEntry("Core", "sick in bed")])
	const card = await cardFor("Thu 20 Aug")

	expect(typeOf(card)).toBe("Skipped")
	expect(typeClassOf(card)).toContain("text-primary")
	expect(contentOf(card)).toEqual(["Core sick in bed"])
})

it("says as much when a day was skipped without anyone saying so", async () => {
	await appendEntries([skippedEntry("Strength")])

	expect(contentOf(await cardFor("Thu 20 Aug"))).toEqual([
		"Strength never logged",
	])
})

it("leaves an ordinary day's type muted", async () => {
	await appendEntries([conditioning("Ab Blaster")])

	expect(typeClassOf(await cardFor("Thu 20 Aug"))).not.toContain("text-primary")
})

it("labels both kinds when a day mixes a session with conditioning", async () => {
	await appendEntries([
		{ ...strengthSet(1, 60, 5), date: "2026-08-20" },
		conditioning("Ab Blaster"),
	])
	const card = await cardFor("Thu 20 Aug")

	expect(typeOf(card)).toBe("Strength · Core")
	expect(contentOf(card)).toEqual([
		"Back squat 60 kg × 5",
		"Ab Blaster level 3 · 5 sets",
	])
})
