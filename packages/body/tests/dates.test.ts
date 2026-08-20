import { describe, expect, it } from "vitest"
import {
	addDays,
	daysBetween,
	isDateString,
	isoWeekOf,
	lastIsoWeeks,
	localDateOf,
	weekdayOf,
} from "$src/dates"

describe("isDateString", () => {
	it("accepts a real calendar date", () => {
		expect(isDateString("2026-08-19")).toBe(true)
	})

	it("rejects malformed strings", () => {
		expect(isDateString("2026-8-19")).toBe(false)
		expect(isDateString("hello")).toBe(false)
		expect(isDateString(20260819)).toBe(false)
	})

	it("rejects impossible dates that would roll over", () => {
		expect(isDateString("2026-02-30")).toBe(false)
		expect(isDateString("2026-13-01")).toBe(false)
	})
})

describe("localDateOf", () => {
	it("uses the Paris calendar day, not the UTC one", () => {
		// 23:30 UTC in August is 01:30 the next day in Paris (UTC+2).
		expect(localDateOf(new Date("2026-08-19T23:30:00Z"))).toBe("2026-08-20")
		// In winter Paris is UTC+1.
		expect(localDateOf(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16")
		expect(localDateOf(new Date("2026-01-15T12:00:00Z"))).toBe("2026-01-15")
	})
})

describe("addDays", () => {
	it("shifts across month and year boundaries", () => {
		expect(addDays("2026-08-19", -1)).toBe("2026-08-18")
		expect(addDays("2026-01-01", -1)).toBe("2025-12-31")
		expect(addDays("2026-08-31", 1)).toBe("2026-09-01")
	})
})

describe("daysBetween", () => {
	it("counts signed days across boundaries", () => {
		expect(daysBetween("2026-08-19", "2026-08-19")).toBe(0)
		expect(daysBetween("2026-08-19", "2026-09-02")).toBe(14)
		expect(daysBetween("2026-01-01", "2025-12-31")).toBe(-1)
	})
})

describe("weekdayOf", () => {
	it("maps Monday to 0 and Sunday to 6", () => {
		expect(weekdayOf("2026-08-17")).toBe(0) // Monday
		expect(weekdayOf("2026-08-19")).toBe(2) // Wednesday
		expect(weekdayOf("2026-08-23")).toBe(6) // Sunday
	})
})

describe("isoWeekOf", () => {
	it("computes ISO week numbers", () => {
		expect(isoWeekOf("2026-08-19")).toBe("2026-W34")
		expect(isoWeekOf("2026-01-01")).toBe("2026-W01")
	})

	it("assigns early January to the previous ISO year when due", () => {
		// 2021-01-01 was a Friday, part of 2020's last week.
		expect(isoWeekOf("2021-01-01")).toBe("2020-W53")
	})
})

describe("lastIsoWeeks", () => {
	it("returns chronological keys ending with the current week", () => {
		expect(lastIsoWeeks("2026-08-19", 3)).toEqual([
			"2026-W32",
			"2026-W33",
			"2026-W34",
		])
	})
})
