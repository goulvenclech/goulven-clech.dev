import { describe, expect, it } from "vitest"
import { liveEntries, retractionOf } from "$src/corrections"
import { LOG_SCHEMA_VERSION, type LogEntry } from "$src/schemas"

const strengthEntry: LogEntry = {
	kind: "strength",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: "11111111-1111-4111-8111-111111111111",
	date: "2026-08-17",
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg: 60,
	reps: 5,
	unit: "reps",
}

const wellnessEntry: LogEntry = {
	kind: "wellness",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: "22222222-2222-4222-8222-222222222222",
	date: "2026-08-17",
	weightKg: 72.4,
}

describe("liveEntries", () => {
	it("drops a retracted entry, and the retraction with it", () => {
		const retraction = retractionOf(strengthEntry)

		expect(liveEntries([strengthEntry, retraction, wellnessEntry])).toEqual([
			wellnessEntry,
		])
	})

	it("applies a retraction that arrives before its target", () => {
		const retraction = retractionOf(strengthEntry)

		expect(liveEntries([retraction, strengthEntry])).toEqual([])
	})

	it("shrugs off a retraction of an entry it never saw", () => {
		const retraction = retractionOf(strengthEntry)

		expect(liveEntries([wellnessEntry, retraction])).toEqual([wellnessEntry])
	})

	it("keeps the target withdrawn when the retraction itself is retracted", () => {
		const retraction = retractionOf(strengthEntry)
		const undo = retractionOf(retraction)

		expect(liveEntries([strengthEntry, retraction, undo])).toEqual([])
	})
})

describe("retractionOf", () => {
	it("stamps the retraction with its target's day and a fresh id", () => {
		const retraction = retractionOf(strengthEntry)

		expect(retraction).toMatchObject({
			kind: "retraction",
			date: "2026-08-17",
			retracts: strengthEntry.id,
		})
		expect(retraction.id).not.toBe(strengthEntry.id)
	})
})
