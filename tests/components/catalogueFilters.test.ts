import { describe, it, expect } from "vitest"
import {
	buildReviewParams,
	toQueryString,
	filtersFromUrl,
	type CatalogueFilters,
} from "../../src/components/catalogue/catalogueFilters"

function makeFilters(
	overrides: Partial<CatalogueFilters> = {},
): CatalogueFilters {
	return {
		query: "",
		rating: "",
		source: "",
		emotion: "",
		sort: "date",
		...overrides,
	}
}

describe("buildReviewParams", () => {
	it("omits empty filters and the default sort", () => {
		const params = buildReviewParams(makeFilters())
		expect(params.toString()).toBe("")
	})

	it("includes every non-empty filter", () => {
		const params = buildReviewParams(
			makeFilters({
				query: "zelda",
				rating: "5",
				source: "IGDB",
				emotion: "3",
				sort: "rating",
			}),
		)
		expect(params.get("query")).toBe("zelda")
		expect(params.get("rating")).toBe("5")
		expect(params.get("source")).toBe("IGDB")
		expect(params.get("emotion")).toBe("3")
		expect(params.get("sort")).toBe("rating")
	})

	it("omits sort when it is the default, includes it otherwise", () => {
		expect(buildReviewParams(makeFilters({ sort: "date" })).has("sort")).toBe(
			false,
		)
		expect(buildReviewParams(makeFilters({ sort: "rating" })).get("sort")).toBe(
			"rating",
		)
	})

	it("adds limit and offset only when pagination is provided", () => {
		const without = buildReviewParams(makeFilters({ source: "BGG" }))
		expect(without.has("limit")).toBe(false)
		expect(without.has("offset")).toBe(false)

		const withPage = buildReviewParams(makeFilters({ source: "BGG" }), {
			limit: 5,
			offset: 10,
		})
		expect(withPage.get("limit")).toBe("5")
		expect(withPage.get("offset")).toBe("10")
		expect(withPage.get("source")).toBe("BGG")
	})
})

describe("toQueryString", () => {
	it("returns an empty string when there are no params", () => {
		expect(toQueryString(new URLSearchParams())).toBe("")
	})

	it("prefixes with '?' when there are params", () => {
		const params = new URLSearchParams({ source: "SPOTIFY" })
		expect(toQueryString(params)).toBe("?source=SPOTIFY")
	})
})

describe("filtersFromUrl", () => {
	it("extracts only the keys present in the URL", () => {
		const params = new URLSearchParams("query=dune&source=TMDB_MOVIE")
		expect(filtersFromUrl(params)).toEqual({
			query: "dune",
			source: "TMDB_MOVIE",
		})
	})

	it("returns an empty object when no known keys are present", () => {
		expect(filtersFromUrl(new URLSearchParams("foo=bar"))).toEqual({})
	})

	it("keeps a present-but-empty value as an empty string", () => {
		expect(filtersFromUrl(new URLSearchParams("query="))).toEqual({ query: "" })
	})
})
