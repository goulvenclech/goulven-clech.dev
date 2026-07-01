import { describe, it, expect } from "vitest"
import { computeListProgress, type ListEntry } from "../src/listProgress"

const movie = (tmdbId: number, name: string): ListEntry => ({
	slug: name.toLowerCase().replace(/\s+/g, "-"),
	type: "movie",
	tmdbId,
	name,
	year: 2000,
})

describe("computeListProgress", () => {
	it("splits entries into seen and unseen by reviewed TMDB id", () => {
		const entries = [movie(1, "A"), movie(2, "B"), movie(3, "C")]
		const progress = computeListProgress(entries, new Set([2]))

		expect(progress.total).toBe(3)
		expect(progress.seenCount).toBe(1)
		expect(progress.seen.map((e) => e.tmdbId)).toEqual([2])
		expect(progress.unseen.map((e) => e.tmdbId)).toEqual([1, 3])
	})

	it("rounds the percentage of trackable entries watched", () => {
		const entries = [movie(1, "A"), movie(2, "B"), movie(3, "C")]
		expect(computeListProgress(entries, new Set([1])).percent).toBe(33)
	})

	it("excludes TV and id-less entries from totals and lists them as untracked", () => {
		const entries: ListEntry[] = [
			movie(10, "Movie"),
			{ slug: "a-show", type: "tv", tmdbId: 999, name: "A Show", year: 2001 },
			{
				slug: "obscure",
				type: null,
				tmdbId: null,
				name: "Obscure",
				year: null,
			},
		]
		const progress = computeListProgress(entries, new Set([10]))

		expect(progress.total).toBe(1)
		expect(progress.seenCount).toBe(1)
		expect(progress.untracked.map((e) => e.slug)).toEqual(["a-show", "obscure"])
	})

	it("does not credit a reviewed id that belongs to a TV entry", () => {
		const entries: ListEntry[] = [
			{ slug: "show", type: "tv", tmdbId: 42, name: "Show", year: 2001 },
		]
		const progress = computeListProgress(entries, new Set([42]))

		expect(progress.seenCount).toBe(0)
		expect(progress.untracked).toHaveLength(1)
	})

	it("returns 0% for an empty trackable set", () => {
		expect(computeListProgress([], new Set()).percent).toBe(0)
	})
})
