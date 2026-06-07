import { describe, it, expect } from "vitest"
import {
	posterUrl,
	buildMovieMeta,
	buildShowMeta,
	type TmdbMovie,
	type TmdbShow,
} from "../../src/pages/api/catalogue/sources/tmdb"

function makeMovie(overrides: Partial<TmdbMovie> = {}): TmdbMovie {
	return {
		id: 1,
		title: "Blade Runner",
		release_date: "1982-06-25",
		poster_path: "/poster.jpg",
		genres: [
			{ id: 1, name: "Sci-Fi" },
			{ id: 2, name: "Thriller" },
		],
		belongs_to_collection: { name: "Blade Runner Collection" },
		alternative_titles: {
			titles: [
				{ title: "BR", type: "Acronym" },
				{ title: "Blade Runner: Final Cut", type: "alternative" },
			],
		},
		production_companies: [{ id: 1, name: "Warner Bros." }],
		credits: {
			crew: [
				{ name: "Ridley Scott", job: "Director" },
				{ name: "Jordan Cronenweth", job: "Director of Photography" },
			],
			cast: [
				{ name: "Harrison Ford" },
				{ name: "Rutger Hauer" },
				{ name: "Sean Young" },
				{ name: "Edward James Olmos" },
			],
		},
		...overrides,
	}
}

function makeShow(overrides: Partial<TmdbShow> = {}): TmdbShow {
	return {
		id: 1,
		name: "The Wire",
		first_air_date: "2002-06-02",
		poster_path: "/poster.jpg",
		genres: [
			{ id: 1, name: "Crime" },
			{ id: 2, name: "Drama" },
		],
		alternative_titles: {
			results: [
				{ title: "TW", type: "Acronym" },
				{ title: "The Wire: Baltimore", type: "alternative" },
			],
		},
		networks: [{ name: "HBO" }],
		aggregate_credits: {
			crew: [
				{ name: "David Simon", job: "Director" },
				{ name: "Some Editor", job: "Editor" },
			],
			cast: [
				{ name: "Dominic West" },
				{ name: "Idris Elba" },
				{ name: "Wendell Pierce" },
				{ name: "Michael K. Williams" },
			],
		},
		...overrides,
	}
}

describe("posterUrl", () => {
	it("builds an image URL with the default size", () => {
		expect(posterUrl("/poster.jpg")).toBe(
			"https://image.tmdb.org/t/p/w500/poster.jpg",
		)
	})

	it("honours a custom size", () => {
		expect(posterUrl("/poster.jpg", "original")).toBe(
			"https://image.tmdb.org/t/p/original/poster.jpg",
		)
	})
})

describe("buildMovieMeta", () => {
	it("returns a pipe-separated string for a full movie", () => {
		expect(buildMovieMeta(makeMovie())).toBe(
			"Sci-Fi, Thriller | Blade Runner Collection | BR | Warner Bros. | Ridley Scott | Harrison Ford, Rutger Hauer, Sean Young",
		)
	})

	it("keeps only acronym-typed alternative titles, matching case-sensitively", () => {
		const movie = makeMovie({
			genres: [],
			belongs_to_collection: null,
			production_companies: [],
			credits: undefined,
			alternative_titles: {
				titles: [
					{ title: "BR", type: "Acronym" },
					{ title: "br-lower", type: "acronym" },
				],
			},
		})
		expect(buildMovieMeta(movie)).toBe("BR")
	})

	it("limits the main cast to the first three names", () => {
		const movie = makeMovie({
			genres: [],
			belongs_to_collection: null,
			production_companies: [],
			alternative_titles: undefined,
			credits: {
				crew: [],
				cast: [
					{ name: "One" },
					{ name: "Two" },
					{ name: "Three" },
					{ name: "Four" },
				],
			},
		})
		expect(buildMovieMeta(movie)).toBe("One, Two, Three")
	})

	it("returns an empty string when no extra relations are present", () => {
		const movie = makeMovie({
			genres: [],
			belongs_to_collection: null,
			alternative_titles: undefined,
			production_companies: [],
			credits: undefined,
		})
		expect(buildMovieMeta(movie)).toBe("")
	})
})

describe("buildShowMeta", () => {
	it("returns a pipe-separated string built from show-specific fields", () => {
		expect(buildShowMeta(makeShow())).toBe(
			"Crime, Drama | TW | HBO | David Simon | Dominic West, Idris Elba, Wendell Pierce",
		)
	})

	it("returns an empty string when no extra relations are present", () => {
		const show = makeShow({
			genres: [],
			alternative_titles: undefined,
			networks: [],
			aggregate_credits: undefined,
		})
		expect(buildShowMeta(show)).toBe("")
	})
})
