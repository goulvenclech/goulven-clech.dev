import { describe, it, expect } from "vitest"
import {
	dayOfWeekAsString,
	getClosedDays,
	scaleToMaxHeight,
} from "../../src/components/blocks/mapsUtils"

describe("dayOfWeekAsString", () => {
	it("maps each index 0–6 to the correct day name", () => {
		expect(dayOfWeekAsString(0)).toBe("sunday")
		expect(dayOfWeekAsString(1)).toBe("monday")
		expect(dayOfWeekAsString(2)).toBe("tuesday")
		expect(dayOfWeekAsString(3)).toBe("wednesday")
		expect(dayOfWeekAsString(4)).toBe("thursday")
		expect(dayOfWeekAsString(5)).toBe("friday")
		expect(dayOfWeekAsString(6)).toBe("saturday")
	})

	it("returns an empty string for out-of-range values", () => {
		expect(dayOfWeekAsString(-1)).toBe("")
		expect(dayOfWeekAsString(7)).toBe("")
		expect(dayOfWeekAsString(100)).toBe("")
		expect(dayOfWeekAsString(NaN)).toBe("")
	})
})

describe("getClosedDays", () => {
	it('returns "Open every day." when all 7 days are present', () => {
		const periods = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ open: { day } }))
		expect(getClosedDays(periods)).toBe("Open every day.")
	})

	it("lists closed days when some days are missing", () => {
		// Open Monday–Friday (1–5)
		const periods = [1, 2, 3, 4, 5].map((day) => ({ open: { day } }))
		expect(getClosedDays(periods)).toBe("Closed on sunday, saturday.")
	})

	it("lists 6 closed days when only 1 day is present", () => {
		const periods = [{ open: { day: 3 } }]
		expect(getClosedDays(periods)).toBe(
			"Closed on sunday, monday, tuesday, thursday, friday, saturday.",
		)
	})

	it('returns "Closed on ..." for all 7 days when periods is an empty array', () => {
		expect(getClosedDays([])).toBe(
			"Closed on sunday, monday, tuesday, wednesday, thursday, friday, saturday.",
		)
	})

	it('returns "Unknown opening days." for non-array inputs', () => {
		expect(getClosedDays(undefined)).toBe("Unknown opening days.")
		expect(getClosedDays(null)).toBe("Unknown opening days.")
		expect(getClosedDays("string")).toBe("Unknown opening days.")
		expect(getClosedDays(42)).toBe("Unknown opening days.")
		expect(getClosedDays({})).toBe("Unknown opening days.")
	})

	it("ignores periods with missing .open?.day entries", () => {
		const periods = [
			{ open: { day: 1 } },
			{ open: {} }, // no day
			{}, // no open
			{ open: { day: 5 } },
			{ open: null },
		]
		expect(getClosedDays(periods)).toBe(
			"Closed on sunday, tuesday, wednesday, thursday, saturday.",
		)
	})
})

describe("scaleToMaxHeight", () => {
	it("scales down proportionally when image is taller than max", () => {
		const result = scaleToMaxHeight(4000, 3000, 750)
		expect(result).toEqual({ width: 1000, height: 750 })
	})

	it("returns original dimensions when image is shorter than max", () => {
		const result = scaleToMaxHeight(640, 480, 750)
		expect(result).toEqual({ width: 640, height: 480 })
	})

	it("returns original dimensions when image is exactly at max height", () => {
		const result = scaleToMaxHeight(1000, 750, 750)
		expect(result).toEqual({ width: 1000, height: 750 })
	})

	it("returns original dimensions for portrait image shorter than max", () => {
		const result = scaleToMaxHeight(480, 640, 750)
		expect(result).toEqual({ width: 480, height: 640 })
	})

	it("returns original dimensions for very wide image shorter than max", () => {
		const result = scaleToMaxHeight(3000, 100, 750)
		expect(result).toEqual({ width: 3000, height: 100 })
	})

	it("scales a square image larger than max to max×max", () => {
		const result = scaleToMaxHeight(1000, 1000, 750)
		expect(result).toEqual({ width: 750, height: 750 })
	})

	it("clamps width to at least 1 for extreme tall/narrow inputs", () => {
		const result = scaleToMaxHeight(1, 5000, 750)
		expect(result).toEqual({ width: 1, height: 750 })
	})
})
