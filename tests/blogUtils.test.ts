import { describe, it, expect, vi, afterEach } from "vitest"
import { isEntryPublished } from "../src/blogUtils"

describe("isEntryPublished", () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it("filters out 'never' entries in all modes", () => {
		expect(isEntryPublished("never")).toBe(false)
		expect(isEntryPublished("never", true)).toBe(false)
	})

	it("filters out 'draft' entries in strict mode", () => {
		expect(isEntryPublished("draft", true)).toBe(false)
	})
})
