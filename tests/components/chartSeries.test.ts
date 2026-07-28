import { describe, it, expect } from "vitest"
import {
	RATING_SERIES,
	SOURCE_SERIES,
	periodLabel,
	sourceLabel,
} from "$components/catalogue/chartSeries"
import { RATING_ORDER, SOURCE_ORDER } from "$src/catalogue/reviewUtils"
import { BACKFILL_PERIOD } from "$src/catalogue/stats"

// `key` joins a series to a pivot cell, so drift there fails silently, in the
// rendered chart rather than in a test.
describe("series keys", () => {
	it("matches the rating keys the pivots emit", () => {
		expect(RATING_SERIES.map((series) => series.key)).toStrictEqual(
			RATING_ORDER.map(String),
		)
	})

	it("matches the source keys the pivots emit", () => {
		expect(SOURCE_SERIES.map((series) => series.key)).toStrictEqual([
			...SOURCE_ORDER,
		])
	})
})

describe("RATING_SERIES", () => {
	it("labels every rating from its own table, never from the raw key", () => {
		expect(RATING_SERIES.map((series) => series.label)).toStrictEqual([
			"hated",
			"disliked",
			"meh'd",
			"liked",
			"loved",
			"favorite",
		])
	})

	it("carries the emoji of every rating", () => {
		expect(RATING_SERIES.map((series) => series.emoji)).toStrictEqual([
			"😡",
			"🙁",
			"😐",
			"😀",
			"😍",
			"⭐",
		])
	})

	it("names one colour custom property per rating", () => {
		expect(RATING_SERIES.map((series) => series.colorVar)).toStrictEqual([
			"--chart-rating-1",
			"--chart-rating-2",
			"--chart-rating-3",
			"--chart-rating-4",
			"--chart-rating-5",
			"--chart-rating-6",
		])
	})
})

describe("SOURCE_SERIES", () => {
	it("labels every media source from its own table, never from the raw key", () => {
		expect(SOURCE_SERIES.map((series) => series.label)).toStrictEqual([
			"video games",
			"board games",
			"movies",
			"shows",
			"albums",
			"books",
		])
	})

	it("numbers the colour custom properties in series order", () => {
		expect(SOURCE_SERIES.map((series) => series.colorVar)).toStrictEqual([
			"--chart-source-1",
			"--chart-source-2",
			"--chart-source-3",
			"--chart-source-4",
			"--chart-source-5",
			"--chart-source-6",
		])
	})
})

describe("sourceLabel", () => {
	it("reads the plural label for a known source", () => {
		expect(sourceLabel("TMDB_TV")).toBe("shows")
	})

	// This one takes whatever key a chart row carries, so the fallback is
	// load-bearing however total the label tables are.
	it("echoes an unknown key rather than rendering nothing", () => {
		expect(sourceLabel("BANDCAMP")).toBe("BANDCAMP")
	})
})

describe("periodLabel", () => {
	it("spells out the backfill bucket", () => {
		expect(periodLabel(BACKFILL_PERIOD)).toBe("before 2025")
	})

	it("leaves a calendar year as-is", () => {
		expect(periodLabel("2026")).toBe("2026")
	})
})
