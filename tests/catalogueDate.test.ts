import { describe, it, expect } from "vitest"
import {
	ERA_RANGES,
	listDaysInRange,
	pickRandomFreeDate,
	todayIsoDay,
	toIsoDay,
} from "../src/catalogueDate"

describe("toIsoDay", () => {
	it("formats a Date as its UTC yyyy-mm-dd", () => {
		expect(toIsoDay(new Date("2023-05-10T00:00:00Z"))).toBe("2023-05-10")
	})

	it("uses the UTC day regardless of time of day", () => {
		expect(toIsoDay(new Date("2023-05-10T23:30:00Z"))).toBe("2023-05-10")
	})
})

describe("todayIsoDay", () => {
	it("formats the local date with zero-padded month and day", () => {
		// Constructed and read with local getters, so timezone-independent.
		expect(todayIsoDay(new Date(2024, 0, 5))).toBe("2024-01-05")
	})
})

describe("listDaysInRange", () => {
	it("includes every day of a single non-leap year", () => {
		const days = listDaysInRange({ startYear: 2003, endYear: 2003 })
		expect(days).toHaveLength(365)
		expect(days[0]).toBe("2003-01-01")
		expect(days.at(-1)).toBe("2003-12-31")
	})

	it("counts the extra day in a leap year", () => {
		expect(listDaysInRange({ startYear: 2004, endYear: 2004 })).toHaveLength(
			366,
		)
	})

	it("spans multiple years inclusively", () => {
		const days = listDaysInRange({ startYear: 2015, endYear: 2019 })
		expect(days[0]).toBe("2015-01-01")
		expect(days.at(-1)).toBe("2019-12-31")
		expect(days).toHaveLength(365 * 5 + 1) // 2016 is the only leap year
	})
})

describe("pickRandomFreeDate", () => {
	const range = { startYear: 2003, endYear: 2003 } as const

	it("returns the first free day when random() is 0", () => {
		expect(pickRandomFreeDate(range, new Set(), () => 0)).toBe("2003-01-01")
	})

	it("returns the last free day when random() approaches 1", () => {
		expect(pickRandomFreeDate(range, new Set(), () => 0.999999)).toBe(
			"2003-12-31",
		)
	})

	it("never returns a used day", () => {
		const free = "2003-06-15"
		const used = new Set(listDaysInRange(range).filter((d) => d !== free))
		for (const r of [0, 0.25, 0.5, 0.75, 0.999999]) {
			expect(pickRandomFreeDate(range, used, () => r)).toBe(free)
		}
	})

	it("indexes into the free days only, skipping used ones", () => {
		// First day taken, so index 0 must land on the second calendar day.
		expect(pickRandomFreeDate(range, new Set(["2003-01-01"]), () => 0)).toBe(
			"2003-01-02",
		)
	})

	it("returns null when every day is already used", () => {
		const used = new Set(listDaysInRange(range))
		expect(pickRandomFreeDate(range, used, () => 0)).toBeNull()
	})
})

describe("ERA_RANGES", () => {
	it("covers the four eras with non-overlapping year spans", () => {
		expect(ERA_RANGES).toEqual({
			"post-covid": { startYear: 2020, endYear: 2024 },
			"pre-covid": { startYear: 2015, endYear: 2019 },
			adolescence: { startYear: 2008, endYear: 2014 },
			jeunesse: { startYear: 2003, endYear: 2007 },
		})
	})
})
