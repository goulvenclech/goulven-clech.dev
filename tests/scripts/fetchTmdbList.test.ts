import { describe, it, expect } from "vitest"
import { posterUrl, movieToEntry } from "../../scripts/fetch-tmdb-list.mjs"
import bondConfig from "../../scripts/list-configs/tmdb/007-films.json"

describe("posterUrl", () => {
	it("builds a TMDB image URL at the default size", () => {
		expect(posterUrl("/abc.jpg")).toBe(
			"https://image.tmdb.org/t/p/w500/abc.jpg",
		)
	})
})

describe("movieToEntry", () => {
	it("maps a TMDB movie to a to-do entry keyed on the requested id", () => {
		expect(
			movieToEntry(646, "Dr. No", {
				id: 646,
				release_date: "1962-10-05",
				poster_path: "/f9.jpg",
			}),
		).toEqual({
			id: 646,
			name: "Dr. No",
			year: 1962,
			poster: "https://image.tmdb.org/t/p/w500/f9.jpg",
			link: "https://www.themoviedb.org/movie/646",
		})
	})

	it("tolerates a missing poster or release date", () => {
		const entry = movieToEntry(1, "X", { release_date: "", poster_path: null })
		expect(entry).toMatchObject({ year: null, poster: null })
	})

	it("adds catalogue meta from the movie's credits and genres", () => {
		const entry = movieToEntry(11545, "Rushmore", {
			release_date: "1998-10-09",
			poster_path: "/x.jpg",
			genres: [{ name: "Comedy" }, { name: "Drama" }],
			production_companies: [{ name: "American Empirical Pictures" }],
			credits: {
				crew: [{ name: "Wes Anderson", job: "Director" }],
				cast: [{ name: "Jason Schwartzman" }],
			},
		})
		expect(entry?.meta).toBe(
			"Comedy, Drama | American Empirical Pictures | Wes Anderson | Jason Schwartzman",
		)
	})

	it("returns null when the movie couldn't be fetched", () => {
		expect(movieToEntry(1, "X", null)).toBeNull()
	})
})

describe("list config contract", () => {
	it("007 list is TMDB movies with [id, name] tuples", () => {
		expect(bondConfig.source).toBe("TMDB_MOVIE")
		expect(bondConfig.movies.length).toBe(27)
		for (const entry of bondConfig.movies) {
			expect(entry).toHaveLength(2)
			expect(typeof entry[0]).toBe("number")
			expect(typeof entry[1]).toBe("string")
		}
	})
})
