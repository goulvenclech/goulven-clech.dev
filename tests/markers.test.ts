import { describe, it, expect } from "vitest"
import { isMarkerVariant, markerTag } from "../src/markers"

describe("markers", () => {
	it("recognises the accent colours that double as marker variants", () => {
		expect(isMarkerVariant("warning")).toBe(true)
		expect(isMarkerVariant("font-light")).toBe(false)
	})

	it("names each variant's custom element, primary by default", () => {
		expect(markerTag("info")).toBe("marker-info")
		expect(markerTag()).toBe("marker-primary")
	})
})
