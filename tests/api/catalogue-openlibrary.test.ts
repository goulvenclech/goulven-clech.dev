import { describe, it, expect } from "vitest"
import {
	bookCoverUrl,
	buildBookMeta,
	fetchBook,
	type OpenLibraryBook,
} from "../../src/pages/api/catalogue/sources/openlibrary"

function makeBook(overrides: Partial<OpenLibraryBook> = {}): OpenLibraryBook {
	return {
		olid: "OL12345M",
		title: "Test Book",
		authors: ["Author One", "Author Two"],
		publishers: ["Publisher A"],
		publishYear: 2020,
		subjects: ["Fiction", "Adventure", "Fantasy"],
		coverOlid: "OL12345M",
		...overrides,
	}
}

describe("bookCoverUrl", () => {
	it("returns the correct OLID-based cover URL", () => {
		expect(bookCoverUrl("OL12345M")).toBe(
			"https://covers.openlibrary.org/b/olid/OL12345M-L.jpg",
		)
	})

	it("works with any OLID format", () => {
		expect(bookCoverUrl("OL999W")).toBe(
			"https://covers.openlibrary.org/b/olid/OL999W-L.jpg",
		)
	})
})

describe("buildBookMeta", () => {
	it("returns pipe-separated string for a full book", () => {
		const book = makeBook()
		expect(buildBookMeta(book)).toBe(
			"Author One, Author Two | Publisher A | Fiction, Adventure, Fantasy",
		)
	})

	it("handles missing subjects", () => {
		const book = makeBook({ subjects: [] })
		expect(buildBookMeta(book)).toBe("Author One, Author Two | Publisher A")
	})

	it("handles missing publishers", () => {
		const book = makeBook({ publishers: [] })
		expect(buildBookMeta(book)).toBe(
			"Author One, Author Two | Fiction, Adventure, Fantasy",
		)
	})

	it("handles missing authors", () => {
		const book = makeBook({ authors: [] })
		expect(buildBookMeta(book)).toBe(
			"Publisher A | Fiction, Adventure, Fantasy",
		)
	})

	it("returns empty string when all fields are empty", () => {
		const book = makeBook({ authors: [], publishers: [], subjects: [] })
		expect(buildBookMeta(book)).toBe("")
	})

	it("limits subjects to 5", () => {
		const book = makeBook({
			subjects: ["One", "Two", "Three", "Four", "Five", "Six", "Seven"],
		})
		expect(buildBookMeta(book)).toBe(
			"Author One, Author Two | Publisher A | One, Two, Three, Four, Five",
		)
	})

	it("handles exactly 5 subjects without truncation", () => {
		const book = makeBook({
			subjects: ["A", "B", "C", "D", "E"],
		})
		expect(buildBookMeta(book)).toBe(
			"Author One, Author Two | Publisher A | A, B, C, D, E",
		)
	})
})

describe("fetchBook input validation", () => {
	it("should reject work OLIDs (suffix W)", async () => {
		const result = await fetchBook("OL21395137W")
		expect(result).toBeNull()
	})

	it("should reject author OLIDs (suffix A)", async () => {
		const result = await fetchBook("OL123456A")
		expect(result).toBeNull()
	})

	it("should reject invalid OLID formats", async () => {
		expect(await fetchBook("")).toBeNull()
		expect(await fetchBook("random-string")).toBeNull()
		expect(await fetchBook("12345")).toBeNull()
	})
})
