import { describe, expect, it } from "vitest"
import {
	buildCountQuery,
	buildSelectQuery,
	parseReviewQuery,
	type ReviewFilters,
} from "../../src/catalogue/reviewQueries"
import {
	buildFacetUrl,
	buildQueryString,
	renderApiDoc,
	renderCatalogue,
	renderFilterSummary,
	renderReviewLine,
	type CatalogueView,
	type DbReviewRow,
	type EmotionRow,
} from "../../src/pages/catalogue.md"

const urlOf = (qs: string) => new URL(`http://localhost:4321/catalogue.md${qs}`)

const parseQuery = (url: URL) => parseReviewQuery(url, 20)

const SITE = "https://example.com"

const testEmotions: EmotionRow[] = [
	{ id: 1, emoji: "🥰", name: "love" },
	{ id: 2, emoji: "🤔", name: "curious" },
]

describe("buildSelectQuery", () => {
	it("returns LIMIT/OFFSET-only query when no filters are set", () => {
		const { sql, args } = buildSelectQuery({ limit: 20 })
		expect(sql).toBe(
			"SELECT * FROM reviews ORDER BY inserted_at DESC, id DESC LIMIT ? OFFSET ?",
		)
		expect(args).toEqual([20, 0])
	})

	it("applies all filters with args in declaration order", () => {
		const { sql, args } = buildSelectQuery({
			search: "witness",
			rating: 6,
			emotion: 3,
			source: "IGDB",
			limit: 10,
			offset: 20,
			sort: "rating",
		})
		expect(sql).toContain("WHERE")
		expect(sql).toContain("source_name LIKE ?")
		expect(sql).toContain("rating = ?")
		expect(sql).toContain("json_each(reviews.emotions)")
		expect(sql).toContain("source = ?")
		expect(sql).toContain("ORDER BY rating DESC, inserted_at DESC")
		expect(args).toEqual([
			"%witness%",
			"%witness%",
			"%witness%",
			6,
			3,
			"IGDB",
			10,
			20,
		])
	})

	it("switches to rating-first ordering when sort=rating", () => {
		const { sql } = buildSelectQuery({ limit: 5, sort: "rating" })
		expect(sql).toContain("ORDER BY rating DESC, inserted_at DESC")
	})

	it("breaks ties on id so the order is total for paging", () => {
		expect(buildSelectQuery({ limit: 5 }).sql).toContain(
			"ORDER BY inserted_at DESC, id DESC",
		)
		expect(buildSelectQuery({ limit: 5, sort: "rating" }).sql).toContain(
			"ORDER BY rating DESC, inserted_at DESC, id DESC",
		)
	})

	it("adds inclusive inserted_at bounds for date filters", () => {
		const { sql, args } = buildSelectQuery({
			limit: 20,
			dateFrom: "2023-01-01T00:00:00.000Z",
			dateTo: "2023-12-31T23:59:59.999Z",
		})
		expect(sql).toContain("inserted_at >= ?")
		expect(sql).toContain("inserted_at <= ?")
		expect(args).toEqual([
			"2023-01-01T00:00:00.000Z",
			"2023-12-31T23:59:59.999Z",
			20,
			0,
		])
	})
})

describe("buildCountQuery", () => {
	it("produces SELECT COUNT(*) with no WHERE when no filters", () => {
		const { sql, args } = buildCountQuery({})
		expect(sql).toBe("SELECT COUNT(*) AS total FROM reviews")
		expect(args).toEqual([])
	})

	it("shares the same WHERE clause and arg ordering as buildSelectQuery", () => {
		const filters: ReviewFilters = {
			search: "x",
			rating: 5,
			emotion: 2,
			source: "BGG",
			sort: "date",
		}
		const { sql: countSql, args: countArgs } = buildCountQuery(filters)
		const { args: selectArgs } = buildSelectQuery({ ...filters, limit: 1 })

		expect(
			countSql.startsWith("SELECT COUNT(*) AS total FROM reviews WHERE"),
		).toBe(true)
		// SELECT args = WHERE args + [limit, offset]; COUNT args = WHERE args only
		expect(countArgs).toEqual(selectArgs.slice(0, -2))
	})
})

describe("parseQuery", () => {
	it("returns defaults for an empty query string", () => {
		const parsed = parseQuery(urlOf(""))
		expect(parsed.limit).toBe(20)
		expect(parsed.offset).toBe(0)
		expect(parsed.filters).toEqual({
			search: undefined,
			rating: undefined,
			emotion: undefined,
			source: undefined,
			sort: "date",
		})
	})

	it("parses every supported filter", () => {
		const parsed = parseQuery(
			urlOf(
				"?query=hi&rating=6&emotion=3&source=IGDB&sort=rating&limit=25&offset=50",
			),
		)
		expect(parsed.limit).toBe(25)
		expect(parsed.offset).toBe(50)
		expect(parsed.filters).toEqual({
			search: "hi",
			rating: 6,
			emotion: 3,
			source: "IGDB",
			sort: "rating",
		})
	})

	it("clamps limit to 1..100", () => {
		expect(parseQuery(urlOf("?limit=0")).limit).toBe(1)
		expect(parseQuery(urlOf("?limit=500")).limit).toBe(100)
		expect(parseQuery(urlOf("?limit=abc")).limit).toBe(20)
	})

	it("rejects out-of-range rating", () => {
		expect(parseQuery(urlOf("?rating=0")).filters.rating).toBeUndefined()
		expect(parseQuery(urlOf("?rating=7")).filters.rating).toBeUndefined()
		expect(parseQuery(urlOf("?rating=abc")).filters.rating).toBeUndefined()
	})

	it("keeps any well-formed emotion id but drops non-integers", () => {
		expect(parseQuery(urlOf("?emotion=99999")).filters.emotion).toBe(99999)
		expect(parseQuery(urlOf("?emotion=3")).filters.emotion).toBe(3)
		expect(parseQuery(urlOf("?emotion=abc")).filters.emotion).toBeUndefined()
		expect(parseQuery(urlOf("?emotion=3.5")).filters.emotion).toBeUndefined()
	})

	it("rejects unknown sources but accepts the canonical set", () => {
		expect(parseQuery(urlOf("?source=BOGUS")).filters.source).toBeUndefined()
		expect(parseQuery(urlOf("?source=TMDB_MOVIE")).filters.source).toBe(
			"TMDB_MOVIE",
		)
	})

	it("falls back to sort=date for unknown sort values", () => {
		expect(parseQuery(urlOf("?sort=banana")).filters.sort).toBe("date")
	})

	it("ignores negative or non-numeric offsets", () => {
		expect(parseQuery(urlOf("?offset=-5")).offset).toBe(0)
		expect(parseQuery(urlOf("?offset=abc")).offset).toBe(0)
	})

	it("resolves year into an inclusive date range", () => {
		const { dateFrom, dateTo } = parseQuery(urlOf("?year=2023")).filters
		expect(dateFrom).toBe("2023-01-01T00:00:00.000Z")
		expect(dateTo).toBe("2023-12-31T23:59:59.999Z")
	})

	it("resolves after/before day bounds inclusively", () => {
		const { dateFrom, dateTo } = parseQuery(
			urlOf("?after=2023-06-01&before=2023-06-30"),
		).filters
		expect(dateFrom).toBe("2023-06-01T00:00:00.000Z")
		expect(dateTo).toBe("2023-06-30T23:59:59.999Z")
	})

	it("intersects year with after (latest start, earliest end)", () => {
		const { dateFrom, dateTo } = parseQuery(
			urlOf("?year=2023&after=2023-07-01"),
		).filters
		expect(dateFrom).toBe("2023-07-01T00:00:00.000Z")
		expect(dateTo).toBe("2023-12-31T23:59:59.999Z")
	})

	it("ignores a malformed date bound", () => {
		const { dateFrom, dateTo } = parseQuery(urlOf("?after=nonsense")).filters
		expect(dateFrom).toBeUndefined()
		expect(dateTo).toBeUndefined()
	})

	it.each(["2023-13-45", "2023-02-30", "2023-02-29", "2023-04-31"])(
		"drops the impossible day %s instead of bounding on it",
		(day) => {
			expect(
				parseQuery(urlOf(`?after=${day}`)).filters.dateFrom,
			).toBeUndefined()
		},
	)

	it("keeps a real leap day", () => {
		expect(parseQuery(urlOf("?after=2024-02-29")).filters.dateFrom).toBe(
			"2024-02-29T00:00:00.000Z",
		)
	})

	it("drops an impossible full instant too, not just a bare day", () => {
		expect(
			parseQuery(urlOf("?after=2023-02-30T00:00:00Z")).filters.dateFrom,
		).toBeUndefined()
		expect(
			parseQuery(urlOf("?before=2023-13-99T99:99:99Z")).filters.dateTo,
		).toBeUndefined()
	})

	it("pads a seconds-precision instant to the millisecond stored form", () => {
		expect(
			parseQuery(urlOf("?after=2023-01-01T00:00:00Z")).filters.dateFrom,
		).toBe("2023-01-01T00:00:00.000Z")
		expect(
			parseQuery(urlOf("?before=2023-12-31T23:59:59Z")).filters.dateTo,
		).toBe("2023-12-31T23:59:59.999Z")
	})

	it("leaves an already-millisecond bound byte-identical", () => {
		expect(
			parseQuery(urlOf("?after=2023-01-01T00:00:00.000Z")).filters.dateFrom,
		).toBe("2023-01-01T00:00:00.000Z")
	})

	it("does not let a seconds-precision bound outrank a year filter", () => {
		expect(
			parseQuery(urlOf("?year=2026&after=2026-01-01T00:00:00Z")).filters
				.dateFrom,
		).toBe("2026-01-01T00:00:00.000Z")
	})
})

describe("buildQueryString", () => {
	it("returns an empty string when all values are defaults", () => {
		expect(buildQueryString({ sort: "date" }, 20, 0)).toBe("")
	})

	it("omits limit when equal to default and offset when 0", () => {
		expect(buildQueryString({ source: "IGDB", sort: "date" }, 20, 0)).toBe(
			"?source=IGDB",
		)
	})

	it("includes non-default limit and any positive offset", () => {
		expect(
			buildQueryString(
				{ rating: 6, emotion: 3, source: "BGG", sort: "rating" },
				25,
				50,
			),
		).toBe("?source=BGG&rating=6&emotion=3&sort=rating&limit=25&offset=50")
	})

	it("round-trips through parseQuery", () => {
		const filters: ReviewFilters = {
			search: "witness",
			rating: 5,
			emotion: 2,
			source: "IGDB",
			sort: "rating",
		}
		const qs = buildQueryString(filters, 10, 30)
		const parsed = parseQuery(urlOf(qs))
		expect(parsed.filters).toEqual(filters)
		expect(parsed.limit).toBe(10)
		expect(parsed.offset).toBe(30)
	})

	it("carries date bounds through pagination and re-parses them", () => {
		const filters: ReviewFilters = {
			sort: "date",
			dateFrom: "2023-01-01T00:00:00.000Z",
			dateTo: "2023-12-31T23:59:59.999Z",
		}
		const parsed = parseQuery(urlOf(buildQueryString(filters, 20, 20)))
		expect(parsed.filters.dateFrom).toBe("2023-01-01T00:00:00.000Z")
		expect(parsed.filters.dateTo).toBe("2023-12-31T23:59:59.999Z")
		expect(parsed.offset).toBe(20)
	})

	it("appends help=0 last when the API section is hidden", () => {
		expect(buildQueryString({ sort: "date" }, 20, 0, false)).toBe("?help=0")
		expect(
			buildQueryString({ source: "IGDB", sort: "date" }, 20, 20, false),
		).toBe("?source=IGDB&offset=20&help=0")
	})

	it("help=0 does not disturb filter parsing", () => {
		const parsed = parseQuery(urlOf("?source=IGDB&help=0"))
		expect(parsed.filters.source).toBe("IGDB")
		expect(parsed.offset).toBe(0)
	})
})

describe("buildFacetUrl", () => {
	it("resets offset and raises a default page size to the max", () => {
		expect(
			buildFacetUrl(SITE, { sort: "date" }, { source: "IGDB" }, 20, true),
		).toBe("https://example.com/catalogue.md?source=IGDB&limit=100")
	})

	it("keeps an explicitly chosen limit", () => {
		expect(
			buildFacetUrl(SITE, { sort: "date" }, { source: "IGDB" }, 10, true),
		).toBe("https://example.com/catalogue.md?source=IGDB&limit=10")
	})

	it("merges the patch over current filters, dropping undefined values", () => {
		expect(
			buildFacetUrl(
				SITE,
				{ source: "IGDB", rating: 6, sort: "date" },
				{ source: undefined },
				20,
				true,
			),
		).toBe("https://example.com/catalogue.md?rating=6&limit=100")
	})

	it("carries the hidden-help state", () => {
		expect(
			buildFacetUrl(SITE, { sort: "date" }, { rating: 3 }, 20, false),
		).toBe("https://example.com/catalogue.md?rating=3&limit=100&help=0")
	})
})

describe("renderApiDoc", () => {
	const doc = (filters: ReviewFilters, limit = 20, offset = 0) =>
		renderApiDoc(testEmotions, SITE, filters, limit, offset)

	it("prints one absolute link per source, rating, sort, and emotion value", () => {
		const lines = doc({ sort: "date" }).split("\n")
		expect(lines).toContain(
			"- IGDB (video games): https://example.com/catalogue.md?source=IGDB&limit=100",
		)
		expect(lines).toContain(
			"- OPENLIBRARY (books): https://example.com/catalogue.md?source=OPENLIBRARY&limit=100",
		)
		expect(lines).toContain(
			"- 6 (favorite): https://example.com/catalogue.md?rating=6&limit=100",
		)
		expect(lines).toContain(
			"- rating (best first): https://example.com/catalogue.md?sort=rating&limit=100",
		)
		expect(lines).toContain(
			"- 2 (🤔 curious): https://example.com/catalogue.md?emotion=2&limit=100",
		)
	})

	it("facet links carry the other active filters but never offset", () => {
		const lines = doc({ rating: 6, sort: "rating" }, 20, 40).split("\n")
		expect(lines).toContain(
			"- BGG (board games): https://example.com/catalogue.md?source=BGG&rating=6&sort=rating&limit=100",
		)
	})

	it("marks the active value and links its removal", () => {
		const lines = doc({ source: "IGDB", sort: "date" }).split("\n")
		expect(lines).toContain(
			"- IGDB (video games): active — remove: https://example.com/catalogue.md?limit=100",
		)
	})

	it("marks the active sort and lets the other value switch it", () => {
		const lines = doc({ sort: "rating" }).split("\n")
		expect(lines).toContain("- rating (best first): active")
		expect(lines).toContain(
			"- date (most recent first): https://example.com/catalogue.md?limit=100",
		)
	})

	it("keeps the current page in the hide link", () => {
		const lines = doc({ sort: "date" }, 20, 40).split("\n")
		expect(lines).toContain(
			"Hide this API section: https://example.com/catalogue.md?offset=40&help=0",
		)
	})

	it("documents the free-form parameters", () => {
		const out = doc({ sort: "date" })
		expect(out).toContain("- query=<text>")
		expect(out).toContain("- help=<0|1>")
	})
})

describe("renderFilterSummary", () => {
	const emotionsById = new Map<number, EmotionRow>(
		testEmotions.map((e) => [e.id, e]),
	)

	it("returns No filters. when nothing is active", () => {
		expect(
			renderFilterSummary({ sort: "date" }, emotionsById, SITE, 20, true),
		).toBe("No filters.")
	})

	it("appends a removal link to every active part", () => {
		expect(
			renderFilterSummary(
				{ source: "IGDB", rating: 6, sort: "date" },
				emotionsById,
				SITE,
				20,
				true,
			),
		).toBe(
			"Filters: source=IGDB (remove: https://example.com/catalogue.md?rating=6&limit=100 ), rating=6 (remove: https://example.com/catalogue.md?source=IGDB&limit=100 ).",
		)
	})

	it("propagates hidden help into removal links", () => {
		expect(
			renderFilterSummary({ sort: "rating" }, emotionsById, SITE, 20, false),
		).toBe(
			"Filters: sort=rating (remove: https://example.com/catalogue.md?limit=100&help=0 ).",
		)
	})
})

describe("renderCatalogue", () => {
	const sampleRow: DbReviewRow = {
		source: "IGDB",
		source_name: "The Witness (2016)",
		rating: 5,
		emotions: "[1]",
		comment: null,
		inserted_at: "2024-01-01T00:00:00Z",
	}

	const baseView: CatalogueView = {
		site: SITE,
		filters: { source: "IGDB", sort: "date" },
		limit: 20,
		offset: 20,
		showHelp: false,
		items: [sampleRow],
		hasMore: true,
		total: 182,
		emotions: testEmotions,
	}

	it("collapses the API section to one line with an expand link", () => {
		const lines = renderCatalogue(baseView).split("\n")
		expect(lines).toContain(
			"API guide hidden. Show filter, sort, and pagination options: https://example.com/catalogue.md?source=IGDB&offset=20",
		)
		expect(renderCatalogue(baseView)).not.toContain("Free-form parameters")
	})

	it("summary removal URLs survive naive extraction with page size and help state intact", () => {
		// The summary is the only removal path when help is collapsed.
		const line = renderCatalogue(baseView)
			.split("\n")
			.find((l) => l.startsWith("Filters:"))
		expect(line).toBeDefined()
		const urls = line?.match(/https?:\/\/\S+/g) ?? []
		expect(urls.length).toBeGreaterThan(0)
		for (const url of urls) {
			expect(url).not.toMatch(/[).,]$/)
			expect(parseReviewQuery(new URL(url), 20).limit).toBe(100)
			expect(new URL(url).searchParams.get("help")).toBe("0")
		}
	})

	it("keeps the expanded API section when help is shown", () => {
		const out = renderCatalogue({ ...baseView, showHelp: true })
		expect(out).toContain("Free-form parameters")
		expect(out).not.toContain("API guide hidden")
	})

	it("propagates every active param plus help through pagination", () => {
		const lines = renderCatalogue(baseView).split("\n")
		expect(lines).toContain(
			"Next page: https://example.com/catalogue.md?source=IGDB&offset=40&help=0",
		)
		expect(lines).toContain(
			"Previous page: https://example.com/catalogue.md?source=IGDB&help=0",
		)
	})

	it("offers a max-page-size jump while smaller pages are in use", () => {
		const lines = renderCatalogue(baseView).split("\n")
		expect(lines).toContain(
			"Max page size: https://example.com/catalogue.md?source=IGDB&limit=100&help=0",
		)
	})

	it("drops the max-page-size link once everything fits", () => {
		const onePage = renderCatalogue({
			...baseView,
			offset: 0,
			hasMore: false,
			total: 15,
		})
		expect(onePage).not.toContain("Max page size:")
		const maxed = renderCatalogue({ ...baseView, offset: 0, limit: 100 })
		expect(maxed).not.toContain("Max page size:")
	})

	it("renders the empty state", () => {
		const out = renderCatalogue({
			...baseView,
			filters: { sort: "date" },
			offset: 0,
			showHelp: true,
			items: [],
			hasMore: false,
			total: 0,
		})
		expect(out).toContain("No filters. Showing 0 of 0.")
		expect(out).toContain("No reviews match these filters.")
	})
})

describe("renderReviewLine", () => {
	const emotionsById = new Map<number, EmotionRow>([
		[1, { id: 1, emoji: "🥰", name: "love" }],
		[2, { id: 2, emoji: "🤔", name: "curious" }],
	])

	const baseRow: DbReviewRow = {
		source: "IGDB",
		source_name: "The Witness (2016)",
		rating: 5,
		emotions: "[1,2]",
		comment: "Brilliant puzzles.",
		inserted_at: "2024-01-01T00:00:00Z",
	}

	it("renders title, rating, felt clause, and comment", () => {
		expect(renderReviewLine(baseRow, emotionsById)).toBe(
			"The Witness (2016) — 😍 loved this game, felt love, curious; « Brilliant puzzles. »",
		)
	})

	it("omits the felt clause when no emotions resolve", () => {
		const row = { ...baseRow, emotions: "[]" }
		expect(renderReviewLine(row, emotionsById)).toBe(
			"The Witness (2016) — 😍 loved this game; « Brilliant puzzles. »",
		)
	})

	it("omits the comment clause when comment is null", () => {
		const row = { ...baseRow, comment: null }
		expect(renderReviewLine(row, emotionsById)).toBe(
			"The Witness (2016) — 😍 loved this game, felt love, curious",
		)
	})

	it("collapses newlines and stray markdown so comments cannot fake structure", () => {
		const row = { ...baseRow, comment: "line one\n## fake heading\nline two" }
		const line = renderReviewLine(row, emotionsById)
		expect(line).not.toContain("\n")
		expect(line).toContain("« line one ## fake heading line two »")
	})

	it("drops unknown emotion ids silently", () => {
		const row = { ...baseRow, emotions: "[1,999]" }
		expect(renderReviewLine(row, emotionsById)).toContain("felt love;")
	})

	it("tolerates a malformed emotions JSON blob", () => {
		const row = { ...baseRow, emotions: "not-json" }
		expect(renderReviewLine(row, emotionsById)).not.toContain("felt")
	})
})
