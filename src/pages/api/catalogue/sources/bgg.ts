import { XMLParser } from "fast-xml-parser"

/**
 * Helpers to fetch BoardGameGeek data.
 * Docs → https://boardgamegeek.com/wiki/page/BGG_XML_API2
 */
const BGG_API = "https://api.geekdo.com/xmlapi2"

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "",
})

export interface BggLink {
	type: string
	value: string
}

export interface BggGame {
	id: number
	name: string
	year?: number
	image?: string
	designers: string[]
	publishers: string[]
	categories: string[]
	mechanics: string[]
}

/** Only the fields we read; other API attributes are ignored. */
interface BggRawItem {
	id: string | number
	name: BggLink | BggLink[]
	yearpublished?: { value: string | number }
	image?: string
	link?: BggLink | BggLink[]
}

export async function fetchBoardGame(id: number): Promise<BggGame | null> {
	const headers: HeadersInit = {}
	if (import.meta.env.BGG_TOKEN) {
		headers["Authorization"] = `Bearer ${import.meta.env.BGG_TOKEN}`
	}
	const res = await fetch(`${BGG_API}/thing?id=${id}&stats=1`, { headers })
	if (!res.ok) return null
	const data = parser.parse(await res.text())
	return parseBggItem(data?.items?.item)
}

/** fast-xml-parser yields an object for one node and an array for many, hence the coercion. */
export function parseBggItem(item: BggRawItem | undefined): BggGame | null {
	if (!item) return null

	const names = Array.isArray(item.name) ? item.name : [item.name]
	const primary = names.find((n) => n.type === "primary")
	const name = primary?.value || names[0]?.value || ""

	const links = item.link
		? Array.isArray(item.link)
			? item.link
			: [item.link]
		: []
	const linkValues = (type: string) =>
		links.filter((l) => l.type === type).map((l) => l.value)

	return {
		id: Number(item.id),
		name,
		year: item.yearpublished ? Number(item.yearpublished.value) : undefined,
		image: item.image,
		designers: linkValues("boardgamedesigner"),
		publishers: linkValues("boardgamepublisher"),
		categories: linkValues("boardgamecategory"),
		mechanics: linkValues("boardgamemechanic"),
	}
}

export function buildBggMeta(game: BggGame): string {
	const parts: string[] = []
	if (game.designers.length) parts.push(game.designers.join(", "))
	if (game.publishers.length) parts.push(game.publishers.join(", "))
	if (game.categories.length) parts.push(game.categories.join(", "))
	if (game.mechanics.length) parts.push(game.mechanics.join(", "))
	return parts.join(" | ")
}
