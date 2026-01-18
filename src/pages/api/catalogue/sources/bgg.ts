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

export async function fetchBoardGame(id: number): Promise<BggGame | null> {
	const headers: HeadersInit = {}
	if (import.meta.env.BGG_TOKEN) {
		headers["Authorization"] = `Bearer ${import.meta.env.BGG_TOKEN}`
	}
	const res = await fetch(`${BGG_API}/thing?id=${id}&stats=1`, { headers })
	if (!res.ok) return null
	const xml = await res.text()
	const data = parser.parse(xml)
	const item = data?.items?.item
	if (!item) return null

	const names = Array.isArray(item.name) ? item.name : [item.name]
	const primary = names.find((n: any) => n.type === "primary")
	const name = primary?.value || names[0]?.value || ""

	const links = item.link
		? Array.isArray(item.link)
			? item.link
			: [item.link]
		: []

	const game: BggGame = {
		id: Number(item.id),
		name,
		year: item.yearpublished ? Number(item.yearpublished.value) : undefined,
		image: item.image,
		designers: links
			.filter((l: any) => l.type === "boardgamedesigner")
			.map((l: any) => l.value),
		publishers: links
			.filter((l: any) => l.type === "boardgamepublisher")
			.map((l: any) => l.value),
		categories: links
			.filter((l: any) => l.type === "boardgamecategory")
			.map((l: any) => l.value),
		mechanics: links
			.filter((l: any) => l.type === "boardgamemechanic")
			.map((l: any) => l.value),
	}
	return game
}

export function buildBggMeta(game: BggGame): string {
	const parts: string[] = []
	if (game.designers.length) parts.push(game.designers.join(", "))
	if (game.publishers.length) parts.push(game.publishers.join(", "))
	if (game.categories.length) parts.push(game.categories.join(", "))
	if (game.mechanics.length) parts.push(game.mechanics.join(", "))
	return parts.join(" | ")
}
