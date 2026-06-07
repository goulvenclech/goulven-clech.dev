import { describe, it, expect } from "vitest"
import { getBitmapDimensions } from "../src/imageService"

describe("getBitmapDimensions", () => {
	it("keeps a square ratio", () => {
		expect(getBitmapDimensions(100, 100, 10_000)).toEqual({
			width: 100,
			height: 100,
		})
	})

	it("keeps a landscape ratio", () => {
		expect(getBitmapDimensions(200, 100, 5_000)).toEqual({
			width: 100,
			height: 50,
		})
	})

	it("keeps a portrait ratio", () => {
		expect(getBitmapDimensions(100, 200, 5_000)).toEqual({
			width: 50,
			height: 100,
		})
	})

	// Pins current unguarded behaviour so adding a guard is a visible change.
	it("yields a degenerate result for a zero source height", () => {
		expect(getBitmapDimensions(100, 0, 10_000)).toEqual({
			width: Infinity,
			height: 0,
		})
	})
})
