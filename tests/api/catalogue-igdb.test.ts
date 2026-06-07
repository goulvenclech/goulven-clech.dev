import { describe, it, expect } from "vitest"
import {
	coverUrl,
	buildIgdbMeta,
	type IgdbGame,
} from "../../src/pages/api/catalogue/sources/igdb"

function makeGame(overrides: Partial<IgdbGame> = {}): IgdbGame {
	return {
		id: 1,
		name: "Hollow Knight",
		slug: "hollow-knight",
		genres: [{ name: "Platform" }, { name: "Adventure" }],
		collection: { name: "Hollow Knight series" },
		alternative_names: [{ name: "HK", comment: "Acronym" }],
		involved_companies: [
			{ developer: true, company: { name: "Team Cherry" } },
			{ publisher: true, company: { name: "Team Cherry" } },
		],
		platforms: [{ name: "PC" }, { name: "Switch" }],
		...overrides,
	}
}

describe("coverUrl", () => {
	it("builds an image URL with the default size", () => {
		expect(coverUrl("abc123")).toBe(
			"https://images.igdb.com/igdb/image/upload/t_cover_big_2x/abc123.jpg",
		)
	})

	it("honours a custom size", () => {
		expect(coverUrl("abc123", "thumb")).toBe(
			"https://images.igdb.com/igdb/image/upload/t_thumb/abc123.jpg",
		)
	})
})

describe("buildIgdbMeta", () => {
	it("returns a pipe-separated string for a full game", () => {
		expect(buildIgdbMeta(makeGame())).toBe(
			"Platform, Adventure | Hollow Knight series | HK | Team Cherry | Team Cherry | PC, Switch",
		)
	})

	it("keeps acronyms only, matching the comment case-insensitively", () => {
		const game = makeGame({
			collection: undefined,
			involved_companies: [],
			platforms: [],
			genres: [],
			alternative_names: [
				{ name: "HK", comment: "acronym" },
				{ name: "Hollow Knight: International", comment: "Localized title" },
				{ name: "Untagged", comment: undefined },
			],
		})
		expect(buildIgdbMeta(game)).toBe("HK")
	})

	it("drops acronym entries whose name is empty", () => {
		const game = makeGame({
			genres: [],
			collection: undefined,
			involved_companies: [],
			platforms: [],
			alternative_names: [
				{ name: "", comment: "Acronym" },
				{ name: "HK", comment: "Acronym" },
			],
		})
		expect(buildIgdbMeta(game)).toBe("HK")
	})

	it("lists a company twice when it both develops and publishes", () => {
		const game = makeGame({
			genres: [],
			collection: undefined,
			alternative_names: [],
			platforms: [],
			involved_companies: [
				{ developer: true, publisher: true, company: { name: "Team Cherry" } },
			],
		})
		expect(buildIgdbMeta(game)).toBe("Team Cherry | Team Cherry")
	})

	it("drops involved companies that carry no company name", () => {
		const game = makeGame({
			genres: [],
			collection: undefined,
			alternative_names: [],
			platforms: [],
			involved_companies: [
				{ developer: true, company: undefined },
				{ developer: true, company: { name: "Real Studio" } },
			],
		})
		expect(buildIgdbMeta(game)).toBe("Real Studio")
	})

	it("returns an empty string when no extra relations are present", () => {
		const game = makeGame({
			genres: [],
			collection: undefined,
			alternative_names: [],
			involved_companies: [],
			platforms: [],
		})
		expect(buildIgdbMeta(game)).toBe("")
	})
})
