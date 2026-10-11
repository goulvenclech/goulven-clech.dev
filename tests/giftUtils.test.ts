import { describe, it, expect } from "vitest"
import {
	formatGiftPrice,
	groupByPriceTier,
	type GiftIdea,
} from "../src/giftUtils"
import { GIFT_IDEAS } from "../src/data/gifts"

const gift = (name: string, price: GiftIdea["price"]): GiftIdea => ({
	name,
	price,
	shop: "A shop",
	link: "/",
})

describe("formatGiftPrice", () => {
	it("formats a fixed price, a range, and a starting price", () => {
		expect(formatGiftPrice(36)).toBe("€36")
		expect(formatGiftPrice({ from: 12, to: 20 })).toBe("€12 to €20")
		expect(formatGiftPrice({ from: 10 })).toBe("From €10")
	})
})

describe("groupByPriceTier", () => {
	it("puts a gift priced at a ceiling in the tier above", () => {
		const tiers = groupByPriceTier([
			gift("Book", 29),
			gift("Game", 30),
			gift("Grinder", 100),
		])
		expect(
			tiers.map((tier) => [tier.label, tier.gifts.map(({ name }) => name)]),
		).toEqual([
			["Under €30", ["Book"]],
			["€30 to €100", ["Game"]],
			["€100 and up", ["Grinder"]],
		])
	})

	it("lists the cheapest gifts first within a tier", () => {
		const [tier] = groupByPriceTier([
			gift("Beans", 20),
			gift("Book", 10),
			gift("Mug", 15),
		])
		expect(tier?.gifts.map(({ name }) => name)).toEqual([
			"Book",
			"Mug",
			"Beans",
		])
	})

	it("files a price range by its lowest price", () => {
		const tiers = groupByPriceTier([
			gift("Credits", { from: 25, to: 120 }),
			gift("Book", 28),
		])
		expect(tiers.map(({ gifts }) => gifts.map(({ name }) => name))).toEqual([
			["Credits", "Book"],
		])
	})

	it("leaves out tiers without gifts", () => {
		const tiers = groupByPriceTier([gift("Book", 10), gift("Trip", 200)])
		expect(tiers.map(({ id }) => id)).toEqual(["under_30", "100_and_up"])
	})

	it("returns no tier for no gifts", () => {
		expect(groupByPriceTier([])).toEqual([])
	})

	it("does not reorder the given gifts", () => {
		const gifts = [gift("Trip", 200), gift("Book", 10)]
		groupByPriceTier(gifts)
		expect(gifts.map(({ name }) => name)).toEqual(["Trip", "Book"])
	})
})

describe("GIFT_IDEAS", () => {
	it("prices every gift in whole positive euros", () => {
		for (const { name, price } of GIFT_IDEAS) {
			const bounds =
				typeof price === "number"
					? [price]
					: [price.from, price.to].filter((bound) => bound !== undefined)
			for (const bound of bounds) {
				expect(Number.isInteger(bound), name).toBe(true)
				expect(bound, name).toBeGreaterThan(0)
			}
		}
	})

	it("links every gift to a site path or an https page", () => {
		for (const { name, link } of GIFT_IDEAS)
			expect(link, name).toMatch(/^(\/|https:\/\/)/)
	})
})
