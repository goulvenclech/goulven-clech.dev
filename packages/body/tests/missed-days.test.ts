import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it } from "vitest"
import { appendEntries, readLog } from "$src/logStore"
import { markMissedDays, missedDays } from "$src/missedDays"
import { LOG_SCHEMA_VERSION, logEntrySchema, type LogEntry } from "$src/schemas"

/** Monday, the first day of a plan week: strength-a. */
const MONDAY = "2026-08-17"
const THURSDAY = "2026-08-20"
const SATURDAY = "2026-08-22"

const strength = (date: string): LogEntry => ({
	kind: "strength",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: crypto.randomUUID(),
	date,
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg: 60,
	reps: 5,
	unit: "reps",
})

const wellness = (date: string): LogEntry => ({
	kind: "wellness",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: crypto.randomUUID(),
	date,
	sleepHours: 8,
})

const datesOf = (log: readonly LogEntry[]) =>
	log.filter((entry) => entry.kind === "skipped").map((entry) => entry.date)

describe("missedDays", () => {
	it("marks every scheduled day that went unlogged, with its planned type", () => {
		expect(
			missedDays([strength(MONDAY)], SATURDAY).map((entry) => [
				entry.date,
				entry.planned,
			]),
		).toEqual([
			["2026-08-18", "Cardio"],
			["2026-08-19", "Combat"],
			["2026-08-21", "Strength"],
		])
	})

	it("gives no reason: nobody was there to give one", () => {
		expect(
			missedDays([strength(MONDAY)], "2026-08-19")[0].reason,
		).toBeUndefined()
	})

	it("leaves rest days and today alone", () => {
		// Saturday 15th to Tuesday 18th, over the plan's Sunday off.
		expect(
			missedDays([strength("2026-08-14")], "2026-08-19").map((e) => e.date),
		).toEqual(["2026-08-15", "2026-08-17", "2026-08-18"])
	})

	it("counts a day the session was logged, or already marked, as settled", () => {
		const log = [strength(MONDAY), ...missedDays([strength(MONDAY)], SATURDAY)]
		expect(missedDays(log, SATURDAY)).toEqual([])
	})

	it("does not take wellness for attendance: it describes the day before", () => {
		expect(
			missedDays([strength(MONDAY), wellness("2026-08-18")], "2026-08-19").map(
				(entry) => entry.date,
			),
		).toEqual(["2026-08-18"])
	})

	it("reaches back no further than the log's first entry", () => {
		expect(
			missedDays([strength(THURSDAY)], SATURDAY).map((e) => e.date),
		).toEqual(["2026-08-21"])
		expect(missedDays([], SATURDAY)).toEqual([])
	})

	it("catches up over one plan cycle, no further", () => {
		// The seven days before Saturday, less the plan's Thursday and Sunday off.
		expect(
			missedDays([strength("2026-01-01")], SATURDAY).map((entry) => entry.date),
		).toEqual([
			"2026-08-15",
			"2026-08-17",
			"2026-08-18",
			"2026-08-19",
			"2026-08-21",
		])
	})

	it("marks nothing from a log that has only ever seen wellness", () => {
		expect(missedDays([wellness("2026-08-18")], "2026-08-19")).toEqual([])
	})

	it("names a day the same on every device, so two of them converge", () => {
		const [mine] = missedDays([strength(MONDAY)], "2026-08-19")
		const [theirs] = missedDays([strength(MONDAY)], "2026-08-19")
		expect(mine.id).toBe(theirs.id)
		expect(logEntrySchema.safeParse(mine).success).toBe(true)
	})
})

describe("markMissedDays", () => {
	beforeEach(() => {
		globalThis.indexedDB = new IDBFactory()
	})

	it("writes the missed days to the log, once", async () => {
		await appendEntries([strength(MONDAY)])

		expect(await markMissedDays("2026-08-19")).toBe(1)
		expect(datesOf(await readLog())).toEqual(["2026-08-18"])

		expect(await markMissedDays("2026-08-19")).toBe(0)
		expect(datesOf(await readLog())).toEqual(["2026-08-18"])
	})
})
