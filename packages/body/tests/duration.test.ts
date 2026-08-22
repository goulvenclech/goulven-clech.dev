import { describe, expect, it } from "vitest"
import { formatHours, formatSeconds, hoursOf, hoursParts } from "$src/duration"

describe("formatHours", () => {
	it("reads a night on the clock", () => {
		expect(formatHours(7.5)).toBe("7 h 30")
		expect(formatHours(8)).toBe("8 h")
	})

	it("pads the minutes, so 7 h 05 never reads as 7 h 50", () => {
		expect(formatHours(hoursOf(7, 5))).toBe("7 h 05")
	})

	it("drops the hours below one", () => {
		expect(formatHours(0.75)).toBe("45 min")
	})

	it("rounds the floats already in the log to the nearest minute", () => {
		expect(formatHours(6.333333333333333)).toBe("6 h 20")
		expect(formatHours(7.99)).toBe("7 h 59")
	})

	it("carries the rounded minute into the hour, so 8 h never reads as 7 h 60", () => {
		expect(formatHours(7.999)).toBe("8 h")
	})
})

describe("hoursParts", () => {
	it("splits the leading number from its tail", () => {
		expect(hoursParts(7.2)).toEqual(["7", " h 12"])
		expect(hoursParts(8)).toEqual(["8", " h"])
		expect(hoursParts(0.5)).toEqual(["30", " min"])
	})
})

describe("formatSeconds", () => {
	it("leaves a short hold in seconds", () => {
		expect(formatSeconds(45)).toBe("45 s")
	})

	it("reads a longer hold in minutes", () => {
		expect(formatSeconds(90)).toBe("1 min 30")
		expect(formatSeconds(120)).toBe("2 min")
		expect(formatSeconds(65)).toBe("1 min 05")
	})
})

describe("hoursOf", () => {
	it("round-trips the clock through the stored number", () => {
		expect(formatHours(hoursOf(7, 20))).toBe("7 h 20")
		expect(formatHours(hoursOf(0, 40))).toBe("40 min")
	})

	it("keeps whole and half hours exact", () => {
		expect(hoursOf(8, 0)).toBe(8)
		expect(hoursOf(7, 30)).toBe(7.5)
	})
})
