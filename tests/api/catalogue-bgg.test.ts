import { describe, it, expect } from "vitest"
import {
	buildBggMeta,
	parseBggItem,
	type BggGame,
} from "../../src/pages/api/catalogue/sources/bgg"

function makeGame(overrides: Partial<BggGame> = {}): BggGame {
	return {
		id: 13,
		name: "Catan",
		year: 1995,
		image: "https://example.com/catan.jpg",
		designers: ["Klaus Teuber"],
		publishers: ["Kosmos", "Catan Studio"],
		categories: ["Negotiation", "Economic"],
		mechanics: ["Dice Rolling", "Trading"],
		...overrides,
	}
}

describe("buildBggMeta", () => {
	it("returns a pipe-separated string for a full game", () => {
		expect(buildBggMeta(makeGame())).toBe(
			"Klaus Teuber | Kosmos, Catan Studio | Negotiation, Economic | Dice Rolling, Trading",
		)
	})

	it("omits empty link lists", () => {
		expect(buildBggMeta(makeGame({ designers: [], mechanics: [] }))).toBe(
			"Kosmos, Catan Studio | Negotiation, Economic",
		)
	})

	it("returns an empty string when every list is empty", () => {
		const empty = makeGame({
			designers: [],
			publishers: [],
			categories: [],
			mechanics: [],
		})
		expect(buildBggMeta(empty)).toBe("")
	})
})

describe("parseBggItem", () => {
	it("returns null for a missing item", () => {
		expect(parseBggItem(undefined)).toBeNull()
	})

	it("normalises a fully populated item", () => {
		const game = parseBggItem({
			id: "13",
			name: [
				{ type: "primary", value: "Catan" },
				{ type: "alternate", value: "Die Siedler von Catan" },
			],
			yearpublished: { value: "1995" },
			image: "https://example.com/catan.jpg",
			link: [
				{ type: "boardgamedesigner", value: "Klaus Teuber" },
				{ type: "boardgamepublisher", value: "Kosmos" },
				{ type: "boardgamecategory", value: "Negotiation" },
				{ type: "boardgamemechanic", value: "Trading" },
				{ type: "boardgamefamily", value: "Ignored Family" },
			],
		})
		expect(game).toEqual({
			id: 13,
			name: "Catan",
			year: 1995,
			image: "https://example.com/catan.jpg",
			designers: ["Klaus Teuber"],
			publishers: ["Kosmos"],
			categories: ["Negotiation"],
			mechanics: ["Trading"],
		})
	})

	it("prefers the primary name regardless of its position", () => {
		const game = parseBggItem({
			id: 1,
			name: [
				{ type: "alternate", value: "Alt" },
				{ type: "primary", value: "Real" },
			],
			link: [],
		})
		expect(game?.name).toBe("Real")
	})

	it("coerces a single name object into the primary name", () => {
		const game = parseBggItem({
			id: 1,
			name: { type: "primary", value: "Solo" },
			link: [],
		})
		expect(game?.name).toBe("Solo")
	})

	it("falls back to the first name when none is marked primary", () => {
		const game = parseBggItem({
			id: 1,
			name: [{ type: "alternate", value: "Only" }],
			link: [],
		})
		expect(game?.name).toBe("Only")
	})

	it("coerces a single link object into a one-element list", () => {
		const game = parseBggItem({
			id: 1,
			name: { type: "primary", value: "X" },
			link: { type: "boardgamedesigner", value: "Solo Designer" },
		})
		expect(game?.designers).toEqual(["Solo Designer"])
	})

	it("groups several links of the same type", () => {
		const game = parseBggItem({
			id: 1,
			name: { type: "primary", value: "X" },
			link: [
				{ type: "boardgamemechanic", value: "Drafting" },
				{ type: "boardgamemechanic", value: "Set Collection" },
			],
		})
		expect(game?.mechanics).toEqual(["Drafting", "Set Collection"])
	})

	it("leaves optional fields undefined and lists empty when absent", () => {
		const game = parseBggItem({
			id: 42,
			name: { type: "primary", value: "Minimal" },
		})
		expect(game).toEqual({
			id: 42,
			name: "Minimal",
			year: undefined,
			image: undefined,
			designers: [],
			publishers: [],
			categories: [],
			mechanics: [],
		})
	})
})
