import { describe, it, expect } from "vitest"
import {
	parseSlugs,
	parseFilm,
	toEntry,
} from "../../scripts/fetch-letterboxd-list.mjs"

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
	it("reads the TMDB id, type and poster from a film page", () => {
		const html = `<body data-tmdb-type="movie" data-tmdb-id="496243">
			<meta property="og:title" content="Parasite (2019)" />
			<script type="application/ld+json">{"image":"https://a.ltrbxd.com/resized/film-poster/4/2/6/4/0/6/426406-parasite-0-600-0-900-crop.jpg"}</script></body>`
		expect(parseFilm(html)).toEqual({
			type: "movie",
			tmdbId: 496243,
			name: "Parasite",
			year: 2019,
			poster:
				"https://a.ltrbxd.com/resized/film-poster/4/2/6/4/0/6/426406-parasite-0-600-0-900-crop.jpg",
		})
	})

	it("reads a poster served from the sm/upload path", () => {
		const html = `<body data-tmdb-type="movie" data-tmdb-id="424">
			<script type="application/ld+json">{"image":"https://a.ltrbxd.com/resized/sm/upload/bz/1x/em/jr/yPis-0-600-0-900-crop.jpg?v=ca5215c5a9"}</script></body>`
		expect(parseFilm(html).poster).toBe(
			"https://a.ltrbxd.com/resized/sm/upload/bz/1x/em/jr/yPis-0-600-0-900-crop.jpg?v=ca5215c5a9",
		)
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

	it("returns null id when the film has no TMDB link", () => {
		const html = `<body class="film">
			<meta property="og:title" content="Some Obscure Film (1920)" /></body>`
		expect(parseFilm(html)).toEqual({
			type: null,
			tmdbId: null,
			name: "Some Obscure Film",
			year: 1920,
			poster: null,
		})
	})

	it("decodes HTML entities and tolerates a missing year in the title", () => {
		const html = `<body data-tmdb-type="movie" data-tmdb-id="1">
			<meta property="og:title" content="Fast &amp; Furious" /></body>`
		const film = parseFilm(html)
		expect(film.name).toBe("Fast & Furious")
		expect(film.year).toBeNull()
	})
})

describe("toEntry", () => {
	it("builds a to-do entry with a TMDB link from a movie", () => {
		expect(
			toEntry("psycho", {
				type: "movie",
				tmdbId: 539,
				name: "Psycho",
				year: 1960,
				poster: "p.jpg",
			}),
		).toEqual({
			id: 539,
			name: "Psycho",
			year: 1960,
			poster: "p.jpg",
			link: "https://www.themoviedb.org/movie/539",
			slug: "psycho",
		})
	})

	it("migrates a legacy entry keyed by tmdbId", () => {
		const entry = toEntry("home-alone", {
			tmdbId: 771,
			name: "Home Alone",
			year: 1990,
			poster: null,
		})
		expect(entry).toMatchObject({ id: 771, slug: "home-alone", poster: null })
	})

	it("returns null for TV or id-less films", () => {
		expect(
			toEntry("a-show", { type: "tv", tmdbId: 1, name: "Show" }),
		).toBeNull()
		expect(
			toEntry("obscure", { type: null, tmdbId: null, name: "Obscure" }),
		).toBeNull()
	})
})
