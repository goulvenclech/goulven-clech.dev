import { describe, it, expect } from "vitest"
import {
	parseSlugs,
	parseFilm,
	toMovie,
} from "../../scripts/fetch-letterboxd-list.mjs"
import moviesConfig from "../../scripts/list-configs/letterboxd/movies-everyone-should-watch.json"

describe("parseSlugs", () => {
	it("extracts film slugs in document order", () => {
		const html = `
			<li><div data-target-link="/film/parasite-2019/"></div></li>
			<li><div data-target-link="/film/whiplash-2014/"></div></li>
		`
		expect(parseSlugs(html)).toEqual(["parasite-2019", "whiplash-2014"])
	})

	it("returns an empty array when a page has no films", () => {
		expect(parseSlugs("<div>no films here</div>")).toEqual([])
	})
})

describe("parseFilm", () => {
	it("reads the TMDB id, type and name, dropping the year suffix", () => {
		const html = `<body data-tmdb-type="movie" data-tmdb-id="496243">
			<meta property="og:title" content="Parasite (2019)" /></body>`
		expect(parseFilm(html)).toEqual({
			type: "movie",
			tmdbId: 496243,
			name: "Parasite",
		})
	})

	it("distinguishes TV entries by type", () => {
		const html = `<body data-tmdb-type="tv" data-tmdb-id="1399">
			<meta property="og:title" content="Game of Thrones (2011)" /></body>`
		const film = parseFilm(html)
		expect(film.type).toBe("tv")
		expect(film.tmdbId).toBe(1399)
	})

	it("reads the id regardless of body attribute order", () => {
		const html = `<body data-tmdb-id="496243" class="film" data-tmdb-type="movie">
			<meta property="og:title" content="Parasite (2019)" /></body>`
		const film = parseFilm(html)
		expect(film.type).toBe("movie")
		expect(film.tmdbId).toBe(496243)
	})

	it("returns a null id when the film has no TMDB link", () => {
		const html = `<body class="film">
			<meta property="og:title" content="Some Obscure Film (1920)" /></body>`
		expect(parseFilm(html)).toEqual({
			type: null,
			tmdbId: null,
			name: "Some Obscure Film",
		})
	})

	it("decodes HTML entities and keeps a year-less title", () => {
		const html = `<body data-tmdb-type="movie" data-tmdb-id="1">
			<meta property="og:title" content="Fast &amp; Furious" /></body>`
		expect(parseFilm(html).name).toBe("Fast & Furious")
	})
})

describe("toMovie", () => {
	it("projects a movie to an [id, name] config tuple", () => {
		expect(toMovie({ type: "movie", tmdbId: 539, name: "Psycho" })).toEqual([
			539,
			"Psycho",
		])
	})

	it("returns null for TV or id-less films", () => {
		expect(toMovie({ type: "tv", tmdbId: 1, name: "Show" })).toBeNull()
		expect(toMovie({ type: null, tmdbId: null, name: "Obscure" })).toBeNull()
	})

	it("returns null when the film's name didn't parse", () => {
		expect(toMovie({ type: "movie", tmdbId: 5, name: null })).toBeNull()
	})
})

describe("list config contract", () => {
	it("movies list crawls a Letterboxd url", () => {
		expect(moviesConfig.source).toBe("TMDB_MOVIE")
		expect(moviesConfig.url).toMatch(/^https:\/\/letterboxd\.com\//)
	})
})
