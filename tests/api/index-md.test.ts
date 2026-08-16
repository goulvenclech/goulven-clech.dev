import { describe, expect, it } from "vitest"
import {
	buildFacetUrl,
	buildHomeQueryString,
	collectFacets,
	parseHomeQuery,
	renderApiDoc,
	renderEntryBlock,
	renderFilterSummary,
	renderHome,
	type EntryView,
	type HomeFilters,
	type HomeView,
} from "../../src/pages/index.md"

const urlOf = (qs: string) => new URL(`http://localhost:4321/index.md${qs}`)

const SITE = "https://example.com"

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

	it("appends help=0 last when the API section is hidden", () => {
		expect(buildHomeQueryString({}, 5, 0, false)).toBe("?help=0")
		expect(buildHomeQueryString({ tag: "coffee" }, 5, 10, false)).toBe(
			"?tag=coffee&offset=10&help=0",
		)
	})

	it("help=0 does not disturb filter parsing", () => {
		const parsed = parseHomeQuery(urlOf("?tag=coffee&help=0"))
		expect(parsed.filters.tag).toBe("coffee")
		expect(parsed.offset).toBe(0)
	})
})

describe("buildFacetUrl", () => {
	it("resets offset and raises a default page size to the max", () => {
		expect(buildFacetUrl(SITE, {}, { tag: "coffee" }, 5, true)).toBe(
			"https://example.com/index.md?tag=coffee&limit=50",
		)
	})

	it("keeps an explicitly chosen limit", () => {
		expect(buildFacetUrl(SITE, {}, { tag: "coffee" }, 10, true)).toBe(
			"https://example.com/index.md?tag=coffee&limit=10",
		)
	})

	it("merges the patch over current filters, dropping undefined values", () => {
		expect(
			buildFacetUrl(
				SITE,
				{ tag: "coffee", year: "2025" },
				{ tag: undefined },
				5,
				true,
			),
		).toBe("https://example.com/index.md?year=2025&limit=50")
	})

	it("carries the hidden-help state", () => {
		expect(buildFacetUrl(SITE, {}, { year: "2025" }, 5, false)).toBe(
			"https://example.com/index.md?year=2025&limit=50&help=0",
		)
	})

	it("encodes spaces and accents so the link round-trips through parse", () => {
		const url = buildFacetUrl(SITE, {}, { tag: "Enchères Immo" }, 5, true)
		expect(url).toBe(
			"https://example.com/index.md?tag=Ench%C3%A8res+Immo&limit=50",
		)
		expect(parseHomeQuery(new URL(url)).filters.tag).toBe("Enchères Immo")
	})
})

describe("collectFacets", () => {
	const row = (date: string, year: number, tags: string[]) => ({
		date,
		year,
		tags,
	})

	it("keeps only featured tags, in featured order", () => {
		const { tags } = collectFacets(
			[row("2025-06-01", 2025, ["coffee", "rust", "linux"])],
			["rust", "coffee"],
		)
		expect(tags).toEqual(["rust", "coffee"])
	})

	it("matches featured tags case-insensitively, newest spelling first", () => {
		const { tags } = collectFacets(
			[
				row("2024-01-01", 2024, ["Coffee"]),
				row("2025-06-01", 2025, ["coffee"]),
				row("2025-07-01", 2025, ["Enchères Immo"]),
			],
			["COFFEE", "enchères immo"],
		)
		expect(tags).toEqual(["coffee", "Enchères Immo"])
	})

	it("skips featured tags no published entry carries", () => {
		const { tags } = collectFacets(
			[row("2025-06-01", 2025, ["coffee"])],
			["coffee", "rust"],
		)
		expect(tags).toEqual(["coffee"])
	})

	it("returns distinct years newest first, as strings", () => {
		const { years } = collectFacets(
			[
				row("2024-01-01", 2024, []),
				row("2025-06-01", 2025, []),
				row("2025-08-01", 2025, []),
			],
			[],
		)
		expect(years).toEqual(["2025", "2024"])
	})
})

describe("renderApiDoc", () => {
	const doc = (filters: HomeFilters, limit = 5, offset = 0) =>
		renderApiDoc(
			["coffee", "rust"],
			["2026", "2025"],
			SITE,
			filters,
			limit,
			offset,
		)

	it("prints one absolute link per tag and year value", () => {
		const lines = doc({}).split("\n")
		expect(lines).toContain(
			"- coffee: https://example.com/index.md?tag=coffee&limit=50",
		)
		expect(lines).toContain(
			"- rust: https://example.com/index.md?tag=rust&limit=50",
		)
		expect(lines).toContain(
			"- 2025: https://example.com/index.md?year=2025&limit=50",
		)
	})

	it("facet links carry the other active filters but never offset", () => {
		const lines = doc({ year: "2025" }, 5, 10).split("\n")
		expect(lines).toContain(
			"- coffee: https://example.com/index.md?tag=coffee&year=2025&limit=50",
		)
	})

	it("marks the active value and links its removal", () => {
		const lines = doc({ tag: "coffee" }).split("\n")
		expect(lines).toContain(
			"- coffee: active — remove: https://example.com/index.md?limit=50",
		)
	})

	it("matches the active tag case-insensitively", () => {
		const lines = doc({ tag: "COFFEE" }).split("\n")
		expect(lines).toContain(
			"- coffee: active — remove: https://example.com/index.md?limit=50",
		)
	})

	it("keeps the current page in the hide link", () => {
		const lines = doc({}, 5, 10).split("\n")
		expect(lines).toContain(
			"Hide this API section: https://example.com/index.md?offset=10&help=0",
		)
	})

	it("still documents the free-form parameters", () => {
		const out = doc({})
		expect(out).toContain("- query=<text>")
		expect(out).toContain("- help=<0|1>")
	})

	it("notes that the tag list is a featured subset", () => {
		expect(doc({})).toContain(
			"- (featured subset; other tags work via tag=<name> or query=<text>)",
		)
	})

	it("prints (none defined) under both facets when no entries exist", () => {
		const out = renderApiDoc([], [], SITE, {}, 5, 0)
		expect(out).toContain("tag:\n- (none defined)")
		expect(out).toContain("year:\n- (none defined)")
	})
})

describe("renderFilterSummary", () => {
	it("returns No filters. when nothing is active", () => {
		expect(renderFilterSummary({}, SITE, 5, true)).toBe("No filters.")
	})

	it("appends a removal link to every active part", () => {
		expect(
			renderFilterSummary({ tag: "coffee", year: "2025" }, SITE, 5, true),
		).toBe(
			"Filters: tag=coffee (remove: https://example.com/index.md?year=2025&limit=50 ), year=2025 (remove: https://example.com/index.md?tag=coffee&limit=50 ).",
		)
	})

	it("propagates hidden help into removal links", () => {
		expect(renderFilterSummary({ query: "rust" }, SITE, 5, false)).toBe(
			'Filters: query="rust" (remove: https://example.com/index.md?limit=50&help=0 ).',
		)
	})
})

describe("renderHome", () => {
	const sampleEntry: EntryView = {
		id: "2025/catalogue-astro-turso",
		title: "Building a catalogue with Astro and Turso",
		abstract: "How and why I built this catalogue.",
		tags: ["software engineering"],
		date: new Date("2025-04-12T00:00:00Z"),
	}

	const baseView: HomeView = {
		site: SITE,
		filters: { tag: "coffee" },
		limit: 5,
		offset: 5,
		showHelp: false,
		entries: [sampleEntry],
		total: 12,
		tags: ["coffee", "rust"],
		years: ["2025"],
	}

	it("collapses the API section to one line with an expand link", () => {
		const lines = renderHome(baseView).split("\n")
		expect(lines).toContain(
			"API guide hidden. Show filter and pagination options: https://example.com/index.md?tag=coffee&offset=5",
		)
		expect(renderHome(baseView)).not.toContain("Free-form parameters")
	})

	it("keeps the expanded API section when help is shown", () => {
		const out = renderHome({ ...baseView, showHelp: true })
		expect(out).toContain("Free-form parameters")
		expect(out).not.toContain("API guide hidden")
	})

	it("propagates every active param plus help through pagination", () => {
		const lines = renderHome(baseView).split("\n")
		expect(lines).toContain(
			"Next page: https://example.com/index.md?tag=coffee&offset=10&help=0",
		)
		expect(lines).toContain(
			"Previous page: https://example.com/index.md?tag=coffee&help=0",
		)
	})

	it("offers a max-page-size jump while smaller pages are in use", () => {
		const lines = renderHome(baseView).split("\n")
		expect(lines).toContain(
			"Max page size: https://example.com/index.md?tag=coffee&limit=50&help=0",
		)
	})

	it("drops the max-page-size link once everything fits", () => {
		const onePage = renderHome({ ...baseView, offset: 0, total: 4 })
		expect(onePage).not.toContain("Max page size:")
		const maxed = renderHome({ ...baseView, offset: 0, limit: 50 })
		expect(maxed).not.toContain("Max page size:")
	})

	it("summary removal URLs survive naive extraction with page size and help state intact", () => {
		const line = renderHome(baseView)
			.split("\n")
			.find((l) => l.startsWith("Filters:"))
		expect(line).toBeDefined()
		const urls = line?.match(/https?:\/\/\S+/g) ?? []
		expect(urls.length).toBeGreaterThan(0)
		for (const url of urls) {
			expect(url).not.toMatch(/[).,]$/)
			expect(parseHomeQuery(new URL(url)).limit).toBe(50)
			expect(new URL(url).searchParams.get("help")).toBe("0")
		}
	})

	it("renders the empty state", () => {
		const out = renderHome({
			...baseView,
			filters: {},
			offset: 0,
			showHelp: true,
			entries: [],
			total: 0,
		})
		expect(out).toContain("No filters. Showing 0 of 0.")
		expect(out).toContain("No entries match these filters.")
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
