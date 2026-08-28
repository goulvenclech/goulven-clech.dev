import { describe, expect, it } from "vitest"
import { sparkline } from "$src/sparkline"

describe("sparkline", () => {
	it("draws one continuous polyline over contiguous values", () => {
		// n=3 → x: 6, 144, 282; y: 58, 32, 6 (min 10 → bottom, max 30 → top).
		expect(sparkline([10, 20, 30]).path).toBe(
			"M6.0 58.0 L144.0 32.0 L282.0 6.0",
		)
	})

	it("breaks the line at a null so a missed week stays visible", () => {
		const { path, last } = sparkline([10, 20, null, 30])
		// A second M — not an L — restarts after the gap.
		expect(path).toBe("M6.0 58.0 L98.0 32.0 M282.0 6.0")
		expect(last).toEqual({ x: 282, y: 6 })
	})

	it("skips leading nulls without emitting a segment", () => {
		const { path } = sparkline([null, 10, 20])
		expect(path).toBe("M144.0 58.0 L282.0 6.0")
		expect(path.match(/M/g)).toHaveLength(1)
	})

	it("frames values on the given bounds rather than on the data", () => {
		expect(sparkline([6, 7, 8], { min: 5, max: 9 }).path).toBe(
			"M6.0 45.0 L144.0 32.0 L282.0 19.0",
		)
	})

	it("hands the edge to a value that overshoots the bounds", () => {
		expect(sparkline([6, 10], { min: 5, max: 9 }).path).toBe(
			"M6.0 47.6 L282.0 6.0",
		)
		expect(sparkline([4, 7], { min: 5, max: 9 }).path).toBe(
			"M6.0 58.0 L282.0 26.8",
		)
	})

	it("keeps a constant series at its own height in the frame", () => {
		expect(sparkline([6, 6], { min: 5, max: 9 }).path).toBe(
			"M6.0 45.0 L282.0 45.0",
		)
	})

	it("centres a single value", () => {
		expect(sparkline([42])).toEqual({
			path: "M144.0 32.0",
			last: { x: 144, y: 32 },
		})
	})

	it("returns an empty path and no last point when all values are null", () => {
		expect(sparkline([null, null])).toEqual({ path: "", last: null })
	})
})
