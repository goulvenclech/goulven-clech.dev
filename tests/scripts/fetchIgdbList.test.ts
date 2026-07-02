import { describe, it, expect } from "vitest"
import {
	yearOf,
	normalizeName,
	coverUrl,
	pickMatch,
} from "../../scripts/fetch-igdb-list.mjs"

const game = (id: number, name: string, year: number | null, cover = true) => ({
	id,
	name,
	slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
	first_release_date: year ? Date.UTC(year, 0, 1) / 1000 : undefined,
	cover: cover ? { image_id: `co${id}` } : undefined,
})

describe("yearOf", () => {
	it("reads the release year from the unix timestamp", () => {
		expect(yearOf(game(1, "X", 1998))).toBe(1998)
		expect(yearOf(game(1, "X", null))).toBeNull()
	})
})

describe("normalizeName", () => {
	it("drops the series prefix and punctuation", () => {
		expect(normalizeName("The Legend of Zelda: Ocarina of Time")).toBe(
			"ocarina of time",
		)
	})
})

describe("coverUrl", () => {
	it("builds an IGDB cover URL", () => {
		expect(coverUrl("co3nnx")).toBe(
			"https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3nnx.jpg",
		)
	})
})

describe("pickMatch", () => {
	it("disambiguates re-releases by year", () => {
		const candidates = [
			game(1027, "The Legend of Zelda: Link's Awakening DX", 1998),
			game(1028, "The Legend of Zelda: Link's Awakening", 1993),
			game(115284, "The Legend of Zelda: Link's Awakening", 2019),
		]
		expect(pickMatch(candidates, "Link's Awakening", 1993)?.id).toBe(1028)
		expect(pickMatch(candidates, "Link's Awakening", 2019)?.id).toBe(115284)
	})

	it("prefers the exact title over editions and fan projects", () => {
		const candidates = [
			game(1039, "The Legend of Zelda: Ocarina of Time 3D", 2011),
			game(89904, "Ocarina of Time 3D: First Edition", 2011),
			game(335717, "Ocarina of Time 3D Randomizer", 2011),
		]
		expect(pickMatch(candidates, "Ocarina of Time 3D", 2011)?.id).toBe(1039)
	})

	it("returns null when nothing survives filtering", () => {
		expect(pickMatch([], "Anything", 2000)).toBeNull()
	})
})
