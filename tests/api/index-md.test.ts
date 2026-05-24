import { describe, expect, it } from "vitest"
import {
	buildHomeQueryString,
	parseHomeQuery,
	renderEntryBlock,
	type EntryView,
	type HomeFilters,
} from "../../src/pages/index.md"

const urlOf = (qs: string) => new URL(`http://localhost:4321/index.md${qs}`)

describe("parseHomeQuery", () => {
	it("returns defaults for an empty query string", () => {
		const parsed = parseHomeQuery(urlOf(""))
		expect(parsed.limit).toBe(5)
		expect(parsed.offset).toBe(0)
		expect(parsed.filters).toEqual({
			query: undefined,
			tag: undefined,
			year: undefined,
		})
	})

	it("parses every supported filter", () => {
		const parsed = parseHomeQuery(
			urlOf("?query=elixir%20rust&tag=coffee&year=2025&limit=10&offset=20"),
		)
		expect(parsed.limit).toBe(10)
		expect(parsed.offset).toBe(20)
		expect(parsed.filters).toEqual({
			query: "elixir rust",
			tag: "coffee",
			year: "2025",
		})
	})

	it("clamps limit to 1..50", () => {
		expect(parseHomeQuery(urlOf("?limit=0")).limit).toBe(1)
		expect(parseHomeQuery(urlOf("?limit=500")).limit).toBe(50)
		expect(parseHomeQuery(urlOf("?limit=abc")).limit).toBe(5)
	})

	it("rejects non-4-digit years", () => {
		expect(parseHomeQuery(urlOf("?year=25")).filters.year).toBeUndefined()
		expect(parseHomeQuery(urlOf("?year=abcd")).filters.year).toBeUndefined()
		expect(parseHomeQuery(urlOf("?year=2025")).filters.year).toBe("2025")
	})

	it("ignores negative or non-numeric offsets", () => {
		expect(parseHomeQuery(urlOf("?offset=-5")).offset).toBe(0)
		expect(parseHomeQuery(urlOf("?offset=abc")).offset).toBe(0)
	})

	it("treats empty filter params as undefined", () => {
		const parsed = parseHomeQuery(urlOf("?query=&tag=&year="))
		expect(parsed.filters).toEqual({
			query: undefined,
			tag: undefined,
			year: undefined,
		})
	})
})

describe("buildHomeQueryString", () => {
	it("returns an empty string when all values are defaults", () => {
		expect(buildHomeQueryString({}, 5, 0)).toBe("")
	})

	it("omits limit when equal to default and offset when 0", () => {
		expect(buildHomeQueryString({ tag: "coffee" }, 5, 0)).toBe("?tag=coffee")
	})

	it("includes non-default limit and any positive offset", () => {
		expect(
			buildHomeQueryString(
				{ query: "elixir rust", tag: "coffee", year: "2025" },
				10,
				20,
			),
		).toBe("?query=elixir+rust&tag=coffee&year=2025&limit=10&offset=20")
	})

	it("round-trips through parseHomeQuery", () => {
		const filters: HomeFilters = {
			query: "elixir rust",
			tag: "coffee",
			year: "2025",
		}
		const qs = buildHomeQueryString(filters, 10, 20)
		const parsed = parseHomeQuery(urlOf(qs))
		expect(parsed.filters).toEqual(filters)
		expect(parsed.limit).toBe(10)
		expect(parsed.offset).toBe(20)
	})
})

describe("renderEntryBlock", () => {
	const site = "https://example.test"
	const base: EntryView = {
		id: "2025/catalogue-astro-turso",
		title: "Building a catalogue with Astro and Turso",
		abstract: "How and why I built this catalogue.",
		tags: ["software engineering", "astro"],
		date: new Date("2025-04-12T00:00:00Z"),
	}

	it("renders title (with link), date, primary tag, and abstract on a single line", () => {
		expect(renderEntryBlock(base, site)).toBe(
			"[Building a catalogue with Astro and Turso](https://example.test/2025/catalogue-astro-turso) published 12 April 2025 in software engineering « How and why I built this catalogue. »",
		)
	})

	it("uses only the first tag when several are present", () => {
		const entry = { ...base, tags: ["coffee", "toulouse"] }
		expect(renderEntryBlock(entry, site)).toContain(" in coffee ")
		expect(renderEntryBlock(entry, site)).not.toContain("toulouse")
	})

	it("omits the tags clause when there are no tags", () => {
		const entry = { ...base, tags: [] }
		expect(renderEntryBlock(entry, site)).toBe(
			"[Building a catalogue with Astro and Turso](https://example.test/2025/catalogue-astro-turso) published 12 April 2025 « How and why I built this catalogue. »",
		)
	})

	it("omits the abstract clause when abstract is empty", () => {
		const entry = { ...base, abstract: "   " }
		expect(renderEntryBlock(entry, site)).toBe(
			"[Building a catalogue with Astro and Turso](https://example.test/2025/catalogue-astro-turso) published 12 April 2025 in software engineering",
		)
	})

	it("collapses newlines and stray markdown so abstracts cannot fake structure", () => {
		const entry = {
			...base,
			abstract: "line one\n## fake heading\nline two",
		}
		const out = renderEntryBlock(entry, site)
		expect(out).not.toContain("\n")
		expect(out).toContain("« line one ## fake heading line two »")
	})
})
