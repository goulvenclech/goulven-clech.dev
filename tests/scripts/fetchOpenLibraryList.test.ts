import { describe, it, expect } from "vitest"
import {
	bookCoverUrl,
	olidCoverUrl,
	normalizeText,
	pickBook,
	bookToEntry,
	olidToEntry,
	editionToEntry,
} from "../../scripts/fetch-openlibrary-list.mjs"
import pileConfig from "../../scripts/list-configs/openlibrary/modern-philosophy-pile.json"

describe("bookCoverUrl", () => {
	it("builds an Open Library cover URL from a cover id", () => {
		expect(bookCoverUrl(8231856)).toBe(
			"https://covers.openlibrary.org/b/id/8231856-L.jpg",
		)
	})
})

describe("olidCoverUrl", () => {
	it("builds an OLID cover URL that 404s when the edition has no cover", () => {
		expect(olidCoverUrl("OL7692564M")).toBe(
			"https://covers.openlibrary.org/b/olid/OL7692564M-L.jpg?default=false",
		)
	})
})

describe("normalizeText", () => {
	it("lowercases and strips punctuation and accents", () => {
		expect(normalizeText("François Kammerer")).toBe("franc ois kammerer")
		expect(normalizeText("Wise Choices, Apt Feelings")).toBe(
			"wise choices apt feelings",
		)
	})
})

describe("pickBook", () => {
	it("prefers the same-author edition and one carrying a cover", () => {
		const docs = [
			{ title: "The Fate of Knowledge", author_name: ["Nobody Else"] },
			{
				title: "The Fate of Knowledge",
				author_name: ["Helen E. Longino"],
				cover_i: 111,
				cover_edition_key: "OL111M",
			},
		]
		expect(
			pickBook(docs, "The Fate of Knowledge", "Helen Longino"),
		).toMatchObject({ cover_edition_key: "OL111M" })
	})

	it("skips a closer title match that carries no edition OLID", () => {
		const docs = [
			{ title: "Republicanism", author_name: ["Philip Pettit"] },
			{
				title: "Republicanism, a theory",
				author_name: ["Philip Pettit"],
				cover_edition_key: "OL5M",
			},
		]
		expect(pickBook(docs, "Republicanism", "Philip Pettit")).toMatchObject({
			cover_edition_key: "OL5M",
		})
	})

	it("rejects a matching author when the title doesn't overlap", () => {
		const docs = [{ title: "A Different Book", author_name: ["Helen Longino"] }]
		expect(pickBook(docs, "The Fate of Knowledge", "Helen Longino")).toBeNull()
	})

	it("rejects a matching title by a different author", () => {
		const docs = [{ title: "Republicanism", author_name: ["Maurizio Viroli"] }]
		expect(pickBook(docs, "Republicanism", "Philip Pettit")).toBeNull()
	})
})

describe("bookToEntry", () => {
	it("keys the entry on the cover edition OLID with an id-based cover", () => {
		expect(
			bookToEntry(
				{
					cover_edition_key: "OL111M",
					cover_i: 8231856,
					edition_key: ["OL9M"],
				},
				"The Fate of Knowledge",
				2002,
			),
		).toEqual({
			id: "OL111M",
			name: "The Fate of Knowledge",
			year: 2002,
			poster: "https://covers.openlibrary.org/b/id/8231856-L.jpg",
			link: "https://openlibrary.org/books/OL111M",
		})
	})

	it("falls back to the first edition key and a null poster when uncovered", () => {
		expect(bookToEntry({ edition_key: ["OL999M"] }, "X", 2000)).toMatchObject({
			id: "OL999M",
			poster: null,
			link: "https://openlibrary.org/books/OL999M",
		})
	})

	it("returns null when the doc has no edition OLID", () => {
		expect(bookToEntry({ cover_i: 1 }, "X", 2000)).toBeNull()
	})
})

describe("olidToEntry", () => {
	it("builds an entry from a bare OLID with an OLID-served cover", () => {
		expect(
			olidToEntry("OL7692564M", "From a Logical Point of View", 1953),
		).toEqual({
			id: "OL7692564M",
			name: "From a Logical Point of View",
			year: 1953,
			poster:
				"https://covers.openlibrary.org/b/olid/OL7692564M-L.jpg?default=false",
			link: "https://openlibrary.org/books/OL7692564M",
		})
	})
})

describe("editionToEntry", () => {
	it("keys on the edition OLID from the record with an id-based cover", () => {
		expect(
			editionToEntry(
				{ key: "/books/OL29498544M", covers: [413225] },
				"What is a Complex System?",
				2020,
			),
		).toEqual({
			id: "OL29498544M",
			name: "What is a Complex System?",
			year: 2020,
			poster: "https://covers.openlibrary.org/b/id/413225-L.jpg",
			link: "https://openlibrary.org/books/OL29498544M",
		})
	})

	it("gives a null poster when the record has no usable cover", () => {
		expect(
			editionToEntry({ key: "/books/OL1M", covers: [-1] }, "X", 2000),
		).toMatchObject({ id: "OL1M", poster: null })
		expect(editionToEntry({ key: "/books/OL2M" }, "Y", 2001)).toMatchObject({
			poster: null,
		})
	})

	it("returns null when the record has no edition key", () => {
		expect(editionToEntry({ covers: [1] }, "X", 2000)).toBeNull()
	})
})

describe("list config contract", () => {
	it("modern-philosophy-pile is an OPENLIBRARY list of [title, author, year] books", () => {
		expect(pileConfig.source).toBe("OPENLIBRARY")
		expect(typeof pileConfig.id).toBe("string")
		expect(pileConfig.books.length).toBeGreaterThan(0)
		for (const book of pileConfig.books) {
			expect(book.length === 3 || book.length === 4).toBe(true)
			const [title, author, year, id] = book
			expect(typeof title).toBe("string")
			expect(typeof author).toBe("string")
			expect(typeof year).toBe("number")
			if (book.length === 4) expect(typeof id).toBe("string")
		}
	})
})
