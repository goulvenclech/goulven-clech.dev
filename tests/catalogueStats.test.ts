import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type Client } from "@libsql/client"
import {
	BACKFILL_PERIOD,
	crossTab,
	fetchEmotionStats,
	fetchReviewFacts,
	listPeriods,
	ratingsByPeriod,
	ratingsBySource,
	sourcesByPeriod,
	totalRow,
	TOTAL_ROW_KEY,
	type ReviewFact,
} from "../src/catalogueStats"

const fact = (
	period: string,
	source: string,
	rating: number,
	count: number,
): ReviewFact => ({ period, source, rating, count })

/**
 * The fetch queries run against an in-memory libsql database: the SQL is where
 * the bucketing, filtering, and unrolling logic lives, so these tests seed real
 * rows and assert on what comes back rather than on the query text.
 */
describe("fetch queries", () => {
	let client: Client

	beforeAll(async () => {
		client = createClient({ url: ":memory:" })
		await client.batch([
			`CREATE TABLE reviews (
				id INTEGER PRIMARY KEY,
				inserted_at TEXT,
				source TEXT,
				rating INTEGER,
				emotions TEXT
			)`,
			`CREATE TABLE emotions (id INTEGER PRIMARY KEY, emoji TEXT, name TEXT)`,
			`INSERT INTO emotions (id, emoji, name) VALUES
				(1, 'J', 'Joy'), (2, 'S', 'Sadness')`,
			// Two pre-catalogue reviews (different years) -> both collapse to backfill.
			`INSERT INTO reviews (inserted_at, source, rating, emotions) VALUES
				('2019-06-01T00:00:00Z', 'IGDB', 4, '[1]'),
				('2024-12-31T23:59:59Z', 'IGDB', 4, '[1,2]'),
				('2025-01-01T00:00:00Z', 'BGG', 6, '[2]'),
				('2026-03-15T00:00:00Z', 'BGG', 6, '[]'),
				('2025-05-05T00:00:00Z', NULL, 3, '[1]'),
				('2025-05-05T00:00:00Z', 'IGDB', NULL, '[1]')`,
		])
	})

	afterAll(() => client.close())

	describe("fetchReviewFacts", () => {
		it("collapses pre-2025 reviews into one backfill bucket and keeps years", async () => {
			const facts = await fetchReviewFacts(client)
			const backfill = facts.filter((f) => f.period === BACKFILL_PERIOD)
			expect(backfill).toEqual([
				{ period: BACKFILL_PERIOD, source: "IGDB", rating: 4, count: 2 },
			])
			const periods = new Set(facts.map((f) => f.period))
			expect(periods).toEqual(new Set([BACKFILL_PERIOD, "2025", "2026"]))
		})

		it("puts the 2025-01-01 boundary itself in the year, not the backfill", async () => {
			const facts = await fetchReviewFacts(client)
			const y2025 = facts.filter((f) => f.period === "2025")
			expect(y2025).toEqual([
				{ period: "2025", source: "BGG", rating: 6, count: 1 },
			])
		})

		it("drops rows with a NULL source or rating", async () => {
			const facts = await fetchReviewFacts(client)
			expect(facts.every((f) => f.source !== null && f.rating !== null)).toBe(
				true,
			)
			// The NULL-source rating-3 row must not leak in anywhere.
			expect(facts.some((f) => f.rating === 3)).toBe(false)
		})
	})

	describe("fetchEmotionStats", () => {
		it("unrolls emotion id arrays, counts uses, averages ratings, sorts by count", async () => {
			const stats = await fetchEmotionStats(client)
			// Joy(1) rides rated reviews only — the NULL-rating row is excluded, but
			// the NULL-source one still counts (only rating is filtered):
			// 2019 (4), 2024 (4), null-source (3) => count 3, avg 11/3.
			const joy = stats.find((s) => s.name === "Joy")
			const sadness = stats.find((s) => s.name === "Sadness")
			expect(joy).toMatchObject({ id: 1, count: 3 })
			expect(joy?.avgRating).toBeCloseTo(11 / 3, 5)
			// Sadness(2): 2024 (4), 2025 (6) => count 2, avg 5.
			expect(sadness).toMatchObject({ id: 2, count: 2, avgRating: 5 })
			expect(stats.map((s) => s.name)).toEqual(["Joy", "Sadness"])
		})
	})
})

describe("listPeriods", () => {
	it("puts backfill first, then years ascending", () => {
		const facts = [
			fact("2027", "IGDB", 4, 1),
			fact(BACKFILL_PERIOD, "IGDB", 4, 1),
			fact("2025", "IGDB", 4, 1),
		]
		expect(listPeriods(facts)).toEqual([BACKFILL_PERIOD, "2025", "2027"])
	})

	it("omits the backfill bucket when nothing predates the catalogue", () => {
		expect(listPeriods([fact("2026", "IGDB", 4, 1)])).toEqual(["2026"])
	})

	it("returns an empty list for no facts", () => {
		expect(listPeriods([])).toEqual([])
	})
})

describe("crossTab", () => {
	it("keeps row and series order and fills missing cells with zero", () => {
		const facts = [fact("2025", "IGDB", 4, 3), fact("2025", "BGG", 6, 1)]
		const rows = crossTab(
			facts,
			(f) => f.period,
			(f) => f.source,
			["2025", "2026"],
			["IGDB", "BGG"],
		)

		expect(rows.map((r) => r.key)).toEqual(["2025", "2026"])
		expect(rows[0].cells.map((c) => c.key)).toEqual(["IGDB", "BGG"])
		expect(rows[0].cells.map((c) => c.count)).toEqual([3, 1])
		// 2026 has no facts, so every cell is a real zero.
		expect(rows[1].total).toBe(0)
		expect(rows[1].cells.every((c) => c.count === 0)).toBe(true)
	})

	it("sums facts that map to the same cell", () => {
		const facts = [fact("2025", "IGDB", 4, 2), fact("2025", "IGDB", 5, 3)]
		const rows = crossTab(
			facts,
			(f) => f.period,
			() => "all",
			["2025"],
			["all"],
		)
		expect(rows[0].cells[0].count).toBe(5)
	})

	it("computes shares against the row total, and 0 for an empty row", () => {
		const facts = [fact("2025", "IGDB", 4, 3), fact("2025", "IGDB", 2, 1)]
		const rows = crossTab(
			facts,
			(f) => f.period,
			(f) => String(f.rating),
			["2025", "2026"],
			["2", "4"],
		)
		expect(rows[0].cells.map((c) => c.share)).toEqual([0.25, 0.75])
		expect(rows[1].cells.map((c) => c.share)).toEqual([0, 0])
	})

	it("gives every row the same cell shape for positional indexing", () => {
		const rows = crossTab(
			[],
			(f) => f.period,
			(f) => f.source,
			["a", "b"],
			["x", "y", "z"],
		)
		expect(rows.every((r) => r.cells.length === 3)).toBe(true)
	})
})

describe("totalRow", () => {
	const rows = crossTab(
		[
			fact("2025", "IGDB", 4, 3),
			fact("2025", "BGG", 2, 1),
			fact("2026", "IGDB", 4, 1),
			fact("2026", "BGG", 2, 5),
		],
		(f) => f.period,
		(f) => f.source,
		["2025", "2026"],
		["IGDB", "BGG"],
	)

	it("sums each series across every row", () => {
		const total = totalRow(rows)
		expect(total.cells.map((c) => c.count)).toEqual([4, 6]) // IGDB 3+1, BGG 1+5
		expect(total.total).toBe(10)
	})

	it("recomputes shares against the summed total, not by averaging rows", () => {
		// Averaging the rows' shares would give 0.5; the real share is 4/10.
		expect(totalRow(rows).cells[0].share).toBeCloseTo(0.4, 5)
	})

	it("keeps the series order so it plots like any other row", () => {
		expect(totalRow(rows).cells.map((c) => c.key)).toEqual(["IGDB", "BGG"])
	})

	it("uses a key that cannot collide with a real row", () => {
		expect(totalRow(rows).key).toBe(TOTAL_ROW_KEY)
		expect(rows.some((r) => r.key === TOTAL_ROW_KEY)).toBe(false)
	})

	it("stays at zero when every row is empty", () => {
		const empty = crossTab(
			[],
			(f) => f.period,
			(f) => f.source,
			["2025"],
			["IGDB"],
		)
		const total = totalRow(empty)
		expect(total.total).toBe(0)
		expect(total.cells[0].share).toBe(0)
	})

	it("handles being given no rows at all", () => {
		expect(totalRow([])).toEqual({ key: TOTAL_ROW_KEY, total: 0, cells: [] })
	})
})

describe("ratingsByPeriod", () => {
	it("has one cell per rating 1–6 in order, per period", () => {
		const rows = ratingsByPeriod([fact("2025", "IGDB", 6, 2)])
		expect(rows).toHaveLength(1)
		expect(rows[0].cells.map((c) => c.key)).toEqual([
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
		])
		expect(rows[0].cells[5].count).toBe(2)
	})

	it("collapses sources so a period's ratings sum across every medium", () => {
		const rows = ratingsByPeriod([
			fact("2025", "IGDB", 4, 2),
			fact("2025", "BGG", 4, 3),
		])
		expect(rows[0].cells[3].count).toBe(5)
	})
})

describe("ratingsBySource", () => {
	it("has one row per media source in the canonical order", () => {
		const rows = ratingsBySource([fact("2025", "SPOTIFY", 5, 1)])
		expect(rows.map((r) => r.key)).toEqual([
			"IGDB",
			"BGG",
			"TMDB_MOVIE",
			"TMDB_TV",
			"SPOTIFY",
			"OPENLIBRARY",
		])
		expect(rows.find((r) => r.key === "SPOTIFY")?.total).toBe(1)
	})

	it("scopes to a single period when asked", () => {
		const facts = [fact("2025", "IGDB", 4, 2), fact("2026", "IGDB", 4, 5)]
		const rows = ratingsBySource(facts, "2026")
		expect(rows.find((r) => r.key === "IGDB")?.total).toBe(5)
	})
})

describe("sourcesByPeriod", () => {
	it("has one cell per source, summed across ratings within a period", () => {
		const rows = sourcesByPeriod([
			fact("2025", "IGDB", 1, 2),
			fact("2025", "IGDB", 6, 1),
			fact("2025", "TMDB_MOVIE", 4, 4),
		])
		const cells = rows[0].cells
		expect(cells[0].key).toBe("IGDB")
		expect(cells[0].count).toBe(3)
		expect(cells[2].count).toBe(4) // TMDB_MOVIE
		expect(rows[0].total).toBe(7)
	})
})
