import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the source modules to test mapping logic without network calls; cover /
// meta helpers return identifiable strings so the wiring can be asserted.
vi.mock("../../src/pages/api/catalogue/sources/igdb", () => ({
	fetchGame: vi.fn(),
	coverUrl: vi.fn((id: string) => `igdb-cover:${id}`),
	buildIgdbMeta: vi.fn(() => "igdb-meta"),
}))
vi.mock("../../src/pages/api/catalogue/sources/bgg", () => ({
	fetchBoardGame: vi.fn(),
	buildBggMeta: vi.fn(() => "bgg-meta"),
}))
vi.mock("../../src/pages/api/catalogue/sources/tmdb", () => ({
	fetchMovie: vi.fn(),
	fetchShow: vi.fn(),
	posterUrl: vi.fn((p: string) => `tmdb-poster:${p}`),
	buildMovieMeta: vi.fn(() => "movie-meta"),
	buildShowMeta: vi.fn(() => "show-meta"),
}))
vi.mock("../../src/pages/api/catalogue/sources/spotify", () => ({
	fetchAlbum: vi.fn(),
	albumCoverUrl: vi.fn(() => "spotify-cover"),
	buildAlbumMeta: vi.fn(() => "album-meta"),
}))
vi.mock("../../src/pages/api/catalogue/sources/openlibrary", () => ({
	fetchBook: vi.fn(),
	bookCoverUrl: vi.fn((olid: string) => `ol-cover:${olid}`),
	buildBookMeta: vi.fn(() => "book-meta"),
}))

import { sourceResolvers } from "../../src/pages/api/catalogue/sourceResolver"
import { fetchGame } from "../../src/pages/api/catalogue/sources/igdb"
import { fetchBoardGame } from "../../src/pages/api/catalogue/sources/bgg"
import {
	fetchMovie,
	fetchShow,
	posterUrl,
} from "../../src/pages/api/catalogue/sources/tmdb"
import { fetchAlbum } from "../../src/pages/api/catalogue/sources/spotify"
import { fetchBook } from "../../src/pages/api/catalogue/sources/openlibrary"

describe("sourceResolvers", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("has no resolver for an unsupported source (the allowlist)", () => {
		expect(sourceResolvers.FOOBAR).toBeUndefined()
	})

	describe("IGDB", () => {
		it("maps a game, formatting the release year and cover", async () => {
			vi.mocked(fetchGame).mockResolvedValue({
				id: 1,
				name: "Hollow Knight",
				slug: "hollow-knight",
				first_release_date: 1488499200, // 2017-03-03 UTC
				cover: { image_id: "abc" },
			})
			expect(await sourceResolvers.IGDB("1")).toEqual({
				source_name: "Hollow Knight (2017)",
				source_link: "https://www.igdb.com/games/hollow-knight",
				source_img: "igdb-cover:abc",
				meta: "igdb-meta",
			})
		})

		it("uses TBD and no image for an unreleased game without a cover", async () => {
			vi.mocked(fetchGame).mockResolvedValue({
				id: 2,
				name: "Silksong",
				slug: "silksong",
			})
			const r = await sourceResolvers.IGDB("2")
			expect(r?.source_name).toBe("Silksong (TBD)")
			expect(r?.source_img).toBe("")
		})

		it("returns null when the game is not found", async () => {
			vi.mocked(fetchGame).mockResolvedValue(null)
			expect(await sourceResolvers.IGDB("404")).toBeNull()
		})
	})

	describe("BGG", () => {
		it("maps a board game", async () => {
			vi.mocked(fetchBoardGame).mockResolvedValue({
				id: 13,
				name: "Catan",
				year: 1995,
				image: "https://img/catan.jpg",
				designers: [],
				publishers: [],
				categories: [],
				mechanics: [],
			})
			expect(await sourceResolvers.BGG("13")).toEqual({
				source_name: "Catan (1995)",
				source_link: "https://boardgamegeek.com/boardgame/13",
				source_img: "https://img/catan.jpg",
				meta: "bgg-meta",
			})
		})

		it("falls back to ?? year and empty image when missing", async () => {
			vi.mocked(fetchBoardGame).mockResolvedValue({
				id: 99,
				name: "Proto",
				designers: [],
				publishers: [],
				categories: [],
				mechanics: [],
			})
			const r = await sourceResolvers.BGG("99")
			expect(r?.source_name).toBe("Proto (??)")
			expect(r?.source_img).toBe("")
		})

		it("returns null when not found", async () => {
			vi.mocked(fetchBoardGame).mockResolvedValue(null)
			expect(await sourceResolvers.BGG("0")).toBeNull()
		})
	})

	describe("TMDB_MOVIE", () => {
		it("maps a movie and builds the poster URL", async () => {
			vi.mocked(fetchMovie).mockResolvedValue({
				id: 27205,
				title: "Inception",
				release_date: "2010-07-16",
				poster_path: "/p.jpg",
			})
			expect(await sourceResolvers.TMDB_MOVIE("27205")).toEqual({
				source_name: "Inception (2010)",
				source_link: "https://www.themoviedb.org/movie/27205",
				source_img: "tmdb-poster:/p.jpg",
				meta: "movie-meta",
			})
			expect(posterUrl).toHaveBeenCalledWith("/p.jpg")
		})

		it("returns null when not found", async () => {
			vi.mocked(fetchMovie).mockResolvedValue(null)
			expect(await sourceResolvers.TMDB_MOVIE("0")).toBeNull()
		})
	})

	describe("TMDB_TV", () => {
		it("maps a show", async () => {
			vi.mocked(fetchShow).mockResolvedValue({
				id: 1396,
				name: "Breaking Bad",
				first_air_date: "2008-01-20",
				poster_path: "/s.jpg",
			})
			expect(await sourceResolvers.TMDB_TV("1396")).toEqual({
				source_name: "Breaking Bad (2008)",
				source_link: "https://www.themoviedb.org/tv/1396",
				source_img: "tmdb-poster:/s.jpg",
				meta: "show-meta",
			})
		})

		it("returns null when not found", async () => {
			vi.mocked(fetchShow).mockResolvedValue(null)
			expect(await sourceResolvers.TMDB_TV("0")).toBeNull()
		})
	})

	describe("SPOTIFY", () => {
		it("maps an album, taking the year from release_date", async () => {
			vi.mocked(fetchAlbum).mockResolvedValue({
				id: "x",
				name: "OK Computer",
				release_date: "1997-05-21",
				images: [{ url: "u", width: 300, height: 300 }],
				genres: [],
				label: "",
				artists: [],
				external_urls: { spotify: "https://open.spotify.com/album/x" },
			})
			expect(await sourceResolvers.SPOTIFY("x")).toEqual({
				source_name: "OK Computer (1997)",
				source_link: "https://open.spotify.com/album/x",
				source_img: "spotify-cover",
				meta: "album-meta",
			})
		})

		it("uses an empty image when the album has no artwork", async () => {
			vi.mocked(fetchAlbum).mockResolvedValue({
				id: "y",
				name: "Demo",
				release_date: "2001-01-01",
				images: [],
				genres: [],
				label: "",
				artists: [],
				external_urls: { spotify: "https://open.spotify.com/album/y" },
			})
			const r = await sourceResolvers.SPOTIFY("y")
			expect(r?.source_img).toBe("")
		})

		it("returns null when not found", async () => {
			vi.mocked(fetchAlbum).mockResolvedValue(null)
			expect(await sourceResolvers.SPOTIFY("0")).toBeNull()
		})
	})

	describe("OPENLIBRARY", () => {
		it("maps a book", async () => {
			vi.mocked(fetchBook).mockResolvedValue({
				olid: "OL1M",
				title: "Dune",
				authors: ["Frank Herbert"],
				publishers: [],
				publishYear: 1965,
				subjects: [],
				coverOlid: "OL1M",
			})
			expect(await sourceResolvers.OPENLIBRARY("OL1M")).toEqual({
				source_name: "Dune (1965)",
				source_link: "https://openlibrary.org/books/OL1M",
				source_img: "ol-cover:OL1M",
				meta: "book-meta",
			})
		})

		it("falls back to ?? year and empty image when missing", async () => {
			vi.mocked(fetchBook).mockResolvedValue({
				olid: "OL2M",
				title: "Unknown",
				authors: [],
				publishers: [],
				subjects: [],
			})
			const r = await sourceResolvers.OPENLIBRARY("OL2M")
			expect(r?.source_name).toBe("Unknown (??)")
			expect(r?.source_img).toBe("")
		})

		it("returns null when not found", async () => {
			vi.mocked(fetchBook).mockResolvedValue(null)
			expect(await sourceResolvers.OPENLIBRARY("bad")).toBeNull()
		})
	})
})
