import { describe, expect, it } from "vitest"
import {
	buildCountQuery,
	buildSelectQuery,
	type ReviewFilters,
} from "../../src/pages/api/catalogue/reviewQueries"
import {
	buildQueryString,
	parseQuery,
	renderReviewLine,
	type DbReviewRow,
	type EmotionRow,
} from "../../src/pages/catalogue.md"

const urlOf = (qs: string) => new URL(`http://localhost:4321/catalogue.md${qs}`)

describe("buildSelectQuery", () => {
	it("returns LIMIT/OFFSET-only query when no filters are set", () => {
		const { sql, args } = buildSelectQuery({ limit: 20 })
		expect(sql).toBe(
			"SELECT * FROM reviews ORDER BY inserted_at DESC LIMIT ? OFFSET ?",
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
