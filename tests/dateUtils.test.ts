import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
	formatDate,
	getMyAge,
	getRemoteWorkYears,
	formatDateRange,
	sortExperiencesByDate,
} from "../src/dateUtils"

describe("formatDate", () => {
	it("formats a date as DD Month YYYY", () => {
		const date = new Date("2025-01-18")
		const result = formatDate(date)
		expect(result).toBe("18 January 2025")
	})

	it("handles different months correctly", () => {
		const date = new Date("2024-07-04")
		const result = formatDate(date)
		expect(result).toBe("4 July 2024")
	})
})

describe("getMyAge", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("calculates age correctly before birthday", () => {
		vi.setSystemTime(new Date("2025-01-18")) // Before November 15
		expect(getMyAge()).toBe(27)
	})

	it("calculates age correctly after birthday", () => {
		vi.setSystemTime(new Date("2025-12-01")) // After November 15
		expect(getMyAge()).toBe(28)
	})
})

describe("getRemoteWorkYears", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("calculates years correctly before March anniversary", () => {
		vi.setSystemTime(new Date("2025-01-18")) // Before March
		expect(getRemoteWorkYears()).toBe(6)
	})

	it("calculates years correctly after March anniversary", () => {
		vi.setSystemTime(new Date("2025-04-01")) // After March
		expect(getRemoteWorkYears()).toBe(7)
	})
})

describe("formatDateRange", () => {
	it("returns 'Month Year - Present' when no end date", () => {
		const result = formatDateRange(new Date("2023-03-01"))
		expect(result).toBe("March 2023 - Present")
	})

	it("returns single date when start and end format identically", () => {
		const result = formatDateRange(
			new Date("2023-03-01"),
			new Date("2023-03-15"),
		)
		expect(result).toBe("March 2023")
	})

	it("omits duplicate year when start and end are in the same year", () => {
		const result = formatDateRange(
			new Date("2023-03-01"),
			new Date("2023-09-01"),
		)
		expect(result).toBe("March - September 2023")
	})

	it("shows full dates when years differ", () => {
		const result = formatDateRange(
			new Date("2021-06-01"),
			new Date("2023-09-01"),
		)
		expect(result).toBe("June 2021 - September 2023")
	})
})

describe("sortExperiencesByDate", () => {
	it("sorts by end date descending when both have end dates", () => {
		const a = {
			data: {
				start_date: new Date("2020-01-01"),
				end_date: new Date("2022-06-01"),
			},
		}
		const b = {
			data: {
				start_date: new Date("2019-01-01"),
				end_date: new Date("2023-01-01"),
			},
		}
		expect(sortExperiencesByDate(a, b)).toBeGreaterThan(0)
		expect(sortExperiencesByDate(b, a)).toBeLessThan(0)
	})

	it("sorts by start date descending when neither has an end date", () => {
		const a = { data: { start_date: new Date("2020-01-01") } }
		const b = { data: { start_date: new Date("2022-01-01") } }
		expect(sortExperiencesByDate(a, b)).toBeGreaterThan(0)
		expect(sortExperiencesByDate(b, a)).toBeLessThan(0)
	})

	it("puts the entry without end date first (current position)", () => {
		const current = { data: { start_date: new Date("2020-01-01") } }
		const past = {
			data: {
				start_date: new Date("2019-01-01"),
				end_date: new Date("2023-01-01"),
			},
		}
		expect(sortExperiencesByDate(current, past)).toBeLessThan(0)
		expect(sortExperiencesByDate(past, current)).toBeGreaterThan(0)
	})
})
