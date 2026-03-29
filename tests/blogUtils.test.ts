import { describe, it, expect, vi, afterEach } from "vitest"
import { isEntryPublished, isFirstAprilEntry } from "../src/blogUtils"

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

describe("isFirstAprilEntry", () => {
	function entry(id: string, date: string) {
		return { id, date: new Date(date) }
	}

	it("returns true for the earliest April entry of its year", () => {
		const entries = [
			entry("a", "2025-04-05"),
			entry("b", "2025-04-15"),
			entry("c", "2025-03-10"),
		]
		expect(isFirstAprilEntry(entries[0], entries)).toBe(true)
	})

	it("returns false for a later April entry of the same year", () => {
		const entries = [entry("a", "2025-04-05"), entry("b", "2025-04-15")]
		expect(isFirstAprilEntry(entries[1], entries)).toBe(false)
	})

	it("returns false for non-April entries", () => {
		const entries = [entry("a", "2025-03-15"), entry("b", "2025-04-10")]
		expect(isFirstAprilEntry(entries[0], entries)).toBe(false)
	})

	it("handles multiple years independently", () => {
		const entries = [
			entry("a", "2024-04-10"),
			entry("b", "2025-04-05"),
			entry("c", "2025-04-20"),
		]
		expect(isFirstAprilEntry(entries[0], entries)).toBe(true)
		expect(isFirstAprilEntry(entries[1], entries)).toBe(true)
		expect(isFirstAprilEntry(entries[2], entries)).toBe(false)
	})

	it("returns false when no April entries exist", () => {
		const entries = [entry("a", "2025-03-15"), entry("b", "2025-05-10")]
		expect(isFirstAprilEntry(entries[0], entries)).toBe(false)
	})

	it("handles a single April entry as the first", () => {
		const entries = [entry("solo", "2025-04-01")]
		expect(isFirstAprilEntry(entries[0], entries)).toBe(true)
	})

	it("uses the entry id to break identity, not just date", () => {
		const entries = [entry("a", "2025-04-01"), entry("b", "2025-04-01")]
		// Same date: sort is stable, first by array order — "a" comes first
		expect(isFirstAprilEntry(entries[0], entries)).toBe(true)
		expect(isFirstAprilEntry(entries[1], entries)).toBe(false)
	})
})
