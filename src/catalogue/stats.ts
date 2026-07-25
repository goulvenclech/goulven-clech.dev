/**
 * Build-time aggregates over the catalogue, for charts embedded in entries.
 * Each dataset is fetched at most once per build, then pivoted in memory:
 * builds stay cheap however many charts an entry renders, and the pivots stay
 * pure so they can be tested without a database.
 */
import { getClient, type Client } from "$src/db"

/**
 * Reviews dated before the catalogue existed are backfill: memories dated by
 * life era rather than by logging day, so their years are noise and collapse
 * into one bucket. Moving this to the catalogue's real birthday (2025-04-24)
 * would also fold in the pre-launch reviews.
 */
export const BACKFILL_END = "2025-01-01"

export const BACKFILL_PERIOD = "backfill"

/** A `period` is either the backfill block or a calendar year (`"2025"`, …). */
export type Period = string

export interface ReviewFact {
	period: Period
	source: string
	rating: number
	count: number
}

/** Media sources, in the order the catalogue's own filters list them. */
export const SOURCE_ORDER = [
	"IGDB",
	"BGG",
	"TMDB_MOVIE",
	"TMDB_TV",
	"SPOTIFY",
	"OPENLIBRARY",
] as const

/** Ratings from hated to favorite, matching `ratingLabels` in `reviewUtils`. */
export const RATING_ORDER = [1, 2, 3, 4, 5, 6] as const

/** Ratings 1–3 sit left of the neutral axis, 4–6 right of it. */
export const NEGATIVE_RATINGS = 3

export async function fetchReviewFacts(
	client: Client = getClient(),
): Promise<ReviewFact[]> {
	const result = await client.execute({
		sql: `SELECT CASE WHEN inserted_at < ? THEN ? ELSE substr(inserted_at, 1, 4) END AS period,
		             source, rating, COUNT(*) AS count
		        FROM reviews
		       WHERE source IS NOT NULL AND rating IS NOT NULL
		    GROUP BY period, source, rating`,
		args: [BACKFILL_END, BACKFILL_PERIOD],
	})
	return result.rows as unknown as ReviewFact[]
}

let cachedFacts: Promise<ReviewFact[]> | null = null

/** Missing config is a broken build, not a hiccup — fail loudly, don't degrade. */
function assertDbConfig(): void {
	if (!import.meta.env.TURSO_URL || !import.meta.env.TURSO_TOKEN) {
		throw new Error("Catalogue stats need TURSO_URL and TURSO_TOKEN to build")
	}
}

/**
 * The facts, fetched at most once per build. Charts degrade to an explicit
 * "no data" state rather than failing the whole site build on a Turso hiccup,
 * since these entries are drafted over years; a missing config throws instead.
 */
export function getReviewFacts(): Promise<ReviewFact[]> {
	assertDbConfig()
	cachedFacts ??= fetchReviewFacts().catch((error) => {
		console.warn("Catalogue stats unavailable at build time:", error)
		return []
	})
	return cachedFacts
}

/** An emotion tag's frequency and the mean rating of the reviews carrying it. */
export interface EmotionStat {
	id: number
	emoji: string
	name: string
	count: number
	avgRating: number
}

export async function fetchEmotionStats(
	client: Client = getClient(),
): Promise<EmotionStat[]> {
	// Emotions are a JSON array of ids on each review, so json_each unrolls them.
	const result = await client.execute(
		`SELECT e.id, e.emoji, e.name, COUNT(*) AS count, AVG(r.rating) AS avgRating
		   FROM reviews r, json_each(r.emotions) AS je
		   JOIN emotions e ON e.id = je.value
		  WHERE r.rating IS NOT NULL
	   GROUP BY e.id, e.emoji, e.name
	   ORDER BY count DESC`,
	)
	return result.rows as unknown as EmotionStat[]
}

let cachedEmotions: Promise<EmotionStat[]> | null = null

/** The emotion stats, fetched at most once per build. Degrades like the facts. */
export function getEmotionStats(): Promise<EmotionStat[]> {
	assertDbConfig()
	cachedEmotions ??= fetchEmotionStats().catch((error) => {
		console.warn("Catalogue emotion stats unavailable at build time:", error)
		return []
	})
	return cachedEmotions
}

/** Backfill first, then years ascending. */
export function listPeriods(facts: ReviewFact[]): Period[] {
	const years = [...new Set(facts.map((f) => f.period))]
		.filter((p) => p !== BACKFILL_PERIOD)
		.sort()
	const hasBackfill = facts.some((f) => f.period === BACKFILL_PERIOD)
	return hasBackfill ? [BACKFILL_PERIOD, ...years] : years
}

export interface Cell {
	key: string
	count: number
	/** Fraction of the row's total, `0` when the row is empty. */
	share: number
}

export interface CrossTabRow {
	key: string
	total: number
	cells: Cell[]
}

/**
 * Pivot facts into one row per `rowOf` value, each carrying a cell per series.
 * Rows and series keep the order given, and empty cells are kept so every row
 * has the same shape — charts and legends can then index them positionally.
 */
export function crossTab(
	facts: ReviewFact[],
	rowOf: (fact: ReviewFact) => string,
	seriesOf: (fact: ReviewFact) => string,
	rowKeys: readonly string[],
	seriesKeys: readonly string[],
): CrossTabRow[] {
	// NUL-delimited so row/series values containing spaces can never collide.
	const counts = new Map<string, number>()
	for (const fact of facts) {
		const cellKey = `${rowOf(fact)}\u0000${seriesOf(fact)}`
		counts.set(cellKey, (counts.get(cellKey) ?? 0) + fact.count)
	}

	return rowKeys.map((rowKey) => {
		const cells = seriesKeys.map((key) => ({
			key,
			count: counts.get(`${rowKey}\u0000${key}`) ?? 0,
			share: 0,
		}))
		const total = cells.reduce((sum, cell) => sum + cell.count, 0)
		if (total > 0) {
			for (const cell of cells) cell.share = cell.count / total
		}
		return { key: rowKey, total, cells }
	})
}

/** Key of the summary row, chosen so it can never collide with a real one. */
export const TOTAL_ROW_KEY = "__total"

/**
 * Sum every row into a single one — the whole catalogue as a baseline to read
 * each period or medium against. Relies on `crossTab` giving every row the same
 * cell shape, so cells line up by position.
 */
export function totalRow(rows: CrossTabRow[]): CrossTabRow {
	const cells: Cell[] = (rows[0]?.cells ?? []).map((cell, index) => ({
		key: cell.key,
		count: rows.reduce((sum, row) => sum + (row.cells[index]?.count ?? 0), 0),
		share: 0,
	}))
	const total = cells.reduce((sum, cell) => sum + cell.count, 0)
	if (total > 0) {
		for (const cell of cells) cell.share = cell.count / total
	}
	return { key: TOTAL_ROW_KEY, total, cells }
}

const ratingKeys = RATING_ORDER.map(String)

/** Rating mix per period — the "did I get harsher?" chart. */
export function ratingsByPeriod(
	facts: ReviewFact[],
	periods = listPeriods(facts),
): CrossTabRow[] {
	return crossTab(
		facts,
		(f) => f.period,
		(f) => String(f.rating),
		periods,
		ratingKeys,
	)
}

export function ratingsBySource(
	facts: ReviewFact[],
	period?: Period,
): CrossTabRow[] {
	const scoped = period ? facts.filter((f) => f.period === period) : facts
	return crossTab(
		scoped,
		(f) => f.source,
		(f) => String(f.rating),
		SOURCE_ORDER,
		ratingKeys,
	)
}

/** Media mix per period — the "what am I actually consuming?" chart. */
export function sourcesByPeriod(
	facts: ReviewFact[],
	periods = listPeriods(facts),
): CrossTabRow[] {
	return crossTab(
		facts,
		(f) => f.period,
		(f) => f.source,
		periods,
		SOURCE_ORDER,
	)
}
