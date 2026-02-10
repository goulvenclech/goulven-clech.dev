import { describe, it, expect } from "vitest"
import {
	filterBlogEntries,
	sortBlogEntries,
} from "../../src/components/search/searchUtils"
import type { BlogEntry } from "../../src/utils"

function mockBlogEntry(overrides: Partial<BlogEntry> = {}): BlogEntry {
	return {
		id: "2025/test-entry",
		title: "Test Entry",
		date: "18 January 2025",
		year: 2025,
		tags: ["typescript", "testing"],
		abstract: "A test blog entry about testing things.",
		imageAlt: "Test image",
		isPublished: true,
		...overrides,
	}
}

const emptyFilters = { query: "", tag: "", year: "", sort: "date" as const }

describe("filterBlogEntries", () => {
	it("returns all entries when no filters are applied", () => {
		const entries = [mockBlogEntry({ id: "a" }), mockBlogEntry({ id: "b" })]
		const result = filterBlogEntries(entries, emptyFilters)
		expect(result).toHaveLength(2)
	})

	it("filters by keyword matching in title", () => {
		const entries = [
			mockBlogEntry({ id: "a", title: "Elixir Guide" }),
			mockBlogEntry({ id: "b", title: "Rust Patterns" }),
		]
		const result = filterBlogEntries(entries, {
			...emptyFilters,
			query: "elixir",
		})
		expect(result).toHaveLength(1)
		expect(result[0].id).toBe("a")
	})

	it("filters by keyword matching in abstract", () => {
		const entries = [
			mockBlogEntry({
				id: "a",
				abstract: "Learn about Phoenix framework",
			}),
			mockBlogEntry({ id: "b", abstract: "Build CLI tools" }),
		]
		const result = filterBlogEntries(entries, {
			...emptyFilters,
			query: "phoenix",
		})
		expect(result).toHaveLength(1)
		expect(result[0].id).toBe("a")
	})

	it("filters by keyword matching in tags", () => {
		const entries = [
			mockBlogEntry({ id: "a", tags: ["coffee", "lifestyle"] }),
			mockBlogEntry({ id: "b", tags: ["rust", "systems"] }),
		]
		const result = filterBlogEntries(entries, {
			...emptyFilters,
			query: "coffee",
		})
		expect(result).toHaveLength(1)
		expect(result[0].id).toBe("a")
	})

	it("requires ALL keywords to match (AND logic)", () => {
		const entries = [
			mockBlogEntry({
				id: "a",
				title: "Elixir and Phoenix",
				abstract: "Web framework",
			}),
			mockBlogEntry({
				id: "b",
				title: "Elixir Basics",
				abstract: "Getting started",
			}),
		]
		const result = filterBlogEntries(entries, {
			...emptyFilters,
			query: "elixir phoenix",
		})
		expect(result).toHaveLength(1)
		expect(result[0].id).toBe("a")
	})

	it("is case-insensitive for query search", () => {
		const entries = [mockBlogEntry({ title: "TypeScript Guide" })]
		const result = filterBlogEntries(entries, {
			...emptyFilters,
			query: "TYPESCRIPT",
		})
		expect(result).toHaveLength(1)
	})

	it("filters by tag (exact match, case-insensitive)", () => {
		const entries = [
			mockBlogEntry({
				id: "a",
				tags: ["software engineering", "elixir"],
			}),
			mockBlogEntry({ id: "b", tags: ["coffee"] }),
		]
		const result = filterBlogEntries(entries, {
			...emptyFilters,
			tag: "Software Engineering",
		})
		expect(result).toHaveLength(1)
		expect(result[0].id).toBe("a")
	})

	it("filters by year", () => {
		const entries = [
			mockBlogEntry({ id: "a", year: 2024 }),
			mockBlogEntry({ id: "b", year: 2025 }),
		]
		const result = filterBlogEntries(entries, {
			...emptyFilters,
			year: "2025",
		})
		expect(result).toHaveLength(1)
		expect(result[0].id).toBe("b")
	})

	it("combines query, tag, and year filters", () => {
		const entries = [
			mockBlogEntry({
				id: "a",
				title: "Elixir Guide",
				tags: ["elixir"],
				year: 2025,
			}),
			mockBlogEntry({
				id: "b",
				title: "Elixir Patterns",
				tags: ["elixir"],
				year: 2024,
			}),
			mockBlogEntry({
				id: "c",
				title: "Rust Guide",
				tags: ["rust"],
				year: 2025,
			}),
		]
		const result = filterBlogEntries(entries, {
			...emptyFilters,
			query: "guide",
			tag: "elixir",
			year: "2025",
		})
		expect(result).toHaveLength(1)
		expect(result[0].id).toBe("a")
	})

	it("returns empty array when nothing matches", () => {
		const entries = [mockBlogEntry()]
		const result = filterBlogEntries(entries, {
			...emptyFilters,
			query: "nonexistent",
		})
		expect(result).toHaveLength(0)
	})

	it("returns empty array for empty input", () => {
		const result = filterBlogEntries([], emptyFilters)
		expect(result).toHaveLength(0)
	})

	it("filters out all entries when year is non-numeric (documents current behavior)", () => {
		const entries = [mockBlogEntry({ year: 2025 })]
		const result = filterBlogEntries(entries, { ...emptyFilters, year: "foo" })
		expect(result).toHaveLength(0)
	})

	it("does not mutate the original array", () => {
		const entries = [mockBlogEntry({ id: "a" }), mockBlogEntry({ id: "b" })]
		const original = [...entries]
		filterBlogEntries(entries, { ...emptyFilters, query: "nonexistent" })
		expect(entries).toEqual(original)
	})
})

describe("sortBlogEntries", () => {
	it("sorts entries newest first", () => {
		const entries = [
			mockBlogEntry({ id: "old", date: "1 January 2023" }),
			mockBlogEntry({ id: "new", date: "15 June 2025" }),
			mockBlogEntry({ id: "mid", date: "20 March 2024" }),
		]
		const result = sortBlogEntries(entries)
		expect(result.map((e) => e.id)).toEqual(["new", "mid", "old"])
	})

	it("returns a new array without mutating the original", () => {
		const entries = [
			mockBlogEntry({ id: "b", date: "1 January 2023" }),
			mockBlogEntry({ id: "a", date: "1 June 2025" }),
		]
		const result = sortBlogEntries(entries)
		expect(result).not.toBe(entries)
		expect(entries[0].id).toBe("b") // original unchanged
	})

	it("handles a single entry", () => {
		const entries = [mockBlogEntry()]
		const result = sortBlogEntries(entries)
		expect(result).toHaveLength(1)
	})

	it("handles an empty array", () => {
		const result = sortBlogEntries([])
		expect(result).toHaveLength(0)
	})
})
