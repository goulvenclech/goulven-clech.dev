import type { ImageMetadata } from "astro"

export interface RemoteImage {
	src: string
	width: number
	height: number
}

export interface PriceRange {
	from: number
	to?: number
}

export interface GiftIdea {
	name: string
	/** Whole euros, so the displayed price never rounds across a tier ceiling. */
	price: number | PriceRange
	shop: string
	link: string
	image?: ImageMetadata | RemoteImage
	/** Trusted inline HTML. */
	details?: string[]
	isbn?: string
}

export interface PriceTier {
	id: string
	label: string
	gifts: GiftIdea[]
}

/** Ascending by ceiling. */
const PRICE_TIERS = [
	{ id: "under_30", label: "Under €30", ceiling: 30 },
	{ id: "30_to_100", label: "€30 to €100", ceiling: 100 },
	{ id: "100_and_up", label: "€100 and up", ceiling: Infinity },
] as const

const priceFormat = new Intl.NumberFormat("en-GB", {
	style: "currency",
	currency: "EUR",
	maximumFractionDigits: 0,
})

export function formatGiftPrice(price: GiftIdea["price"]): string {
	if (typeof price === "number") return priceFormat.format(price)
	if (price.to === undefined) return `From ${priceFormat.format(price.from)}`
	return `${priceFormat.format(price.from)} to ${priceFormat.format(price.to)}`
}

function lowestPrice({ price }: GiftIdea): number {
	return typeof price === "number" ? price : price.from
}

export function groupByPriceTier(gifts: readonly GiftIdea[]): PriceTier[] {
	const byPrice = [...gifts].sort((a, b) => lowestPrice(a) - lowestPrice(b))
	return PRICE_TIERS.map(({ id, label, ceiling }, index) => {
		const floor = PRICE_TIERS[index - 1]?.ceiling ?? 0
		return {
			id,
			label,
			gifts: byPrice.filter(
				(gift) => lowestPrice(gift) >= floor && lowestPrice(gift) < ceiling,
			),
		}
	}).filter((tier) => tier.gifts.length > 0)
}
