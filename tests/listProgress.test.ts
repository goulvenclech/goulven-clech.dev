import { describe, it, expect } from "vitest"
import {
	buildListItems,
	computeListProgress,
	filterListItems,
	sortListItems,
	type ListEntry,
	type ListItem,
	type ReviewInfo,
} from "../src/listProgress"

const movie = (tmdbId: number, name: string, year = 2000): ListEntry => ({
	slug: name.toLowerCase().replace(/\s+/g, "-"),
	type: "movie",
	tmdbId,
	name,
	year,
	poster: `poster-${tmdbId}.jpg`,
})

const item = (over: Partial<ListItem>): ListItem => ({
	tmdbId: 1,
	name: "A",
	year: 2000,
	poster: null,
	seen: false,
	emoji: null,
	href: "",
	...over,
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
			{
				slug: "a-show",
				type: "tv",
				tmdbId: 999,
				name: "A Show",
				year: 2001,
				poster: null,
			},
			{
				slug: "obscure",
				type: null,
				tmdbId: null,
				name: "Obscure",
				year: null,
				poster: null,
			},
		]
		const progress = computeListProgress(entries, new Set([10]))

		expect(progress.total).toBe(1)
		expect(progress.seenCount).toBe(1)
		expect(progress.untracked.map((e) => e.slug)).toEqual(["a-show", "obscure"])
	})

	it("does not credit a reviewed id that belongs to a TV entry", () => {
		const entries: ListEntry[] = [
			{
				slug: "show",
				type: "tv",
				tmdbId: 42,
				name: "Show",
				year: 2001,
				poster: null,
			},
		]
		const progress = computeListProgress(entries, new Set([42]))

		expect(progress.seenCount).toBe(0)
		expect(progress.untracked).toHaveLength(1)
	})

	it("returns 0% for an empty trackable set", () => {
		expect(computeListProgress([], new Set()).percent).toBe(0)
	})
})

describe("buildListItems", () => {
	it("links seen films to the catalogue and unseen films to TMDB", () => {
		const entries = [movie(1, "Seen"), movie(2, "Unseen")]
		const reviews = new Map<number, ReviewInfo>([
			[1, { title: "Seen (2000)", emoji: "😍" }],
		])
		const [seen, unseen] = buildListItems(entries, reviews)

		expect(seen).toMatchObject({ seen: true, emoji: "😍" })
		expect(seen.href).toBe("/catalogue?query=Seen%20(2000)&source=TMDB_MOVIE")
		expect(unseen).toMatchObject({ seen: false, emoji: null })
		expect(unseen.href).toBe("https://www.themoviedb.org/movie/2")
	})

	it("skips TV and id-less entries", () => {
		const entries: ListEntry[] = [
			movie(1, "Movie"),
			{
				slug: "show",
				type: "tv",
				tmdbId: 9,
				name: "Show",
				year: 2001,
				poster: null,
			},
		]
		expect(buildListItems(entries, new Map())).toHaveLength(1)
	})
})

describe("filterListItems", () => {
	const items = [
		item({ tmdbId: 1, name: "Alien", seen: true }),
		item({ tmdbId: 2, name: "Aliens", seen: false }),
		item({ tmdbId: 3, name: "Heat", seen: true }),
	]

	it("matches names case-insensitively", () => {
		expect(
			filterListItems(items, { query: "alien" }).map((i) => i.tmdbId),
		).toEqual([1, 2])
	})

	it("filters by seen status", () => {
		expect(
			filterListItems(items, { status: "unseen" }).map((i) => i.tmdbId),
		).toEqual([2])
	})

	it("combines query and status", () => {
		expect(
			filterListItems(items, { query: "alien", status: "seen" }).map(
				(i) => i.tmdbId,
			),
		).toEqual([1])
	})
})

describe("sortListItems", () => {
	const items = [
		item({ tmdbId: 1, name: "Zulu", year: 1999 }),
		item({ tmdbId: 2, name: "Alpha", year: 1999 }),
		item({ tmdbId: 3, name: "Beta", year: 1980 }),
	]

	it("sorts oldest first, breaking year ties alphabetically", () => {
		expect(sortListItems(items, "year-asc").map((i) => i.tmdbId)).toEqual([
			3, 2, 1,
		])
	})

	it("sorts newest first, still breaking ties alphabetically", () => {
		expect(sortListItems(items, "year-desc").map((i) => i.tmdbId)).toEqual([
			2, 1, 3,
		])
	})
})
