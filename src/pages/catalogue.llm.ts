import type { APIContext } from "astro"
import { createClient } from "@libsql/client"

export const prerender = false

export async function GET(_context: APIContext): Promise<Response> {
	try {
		const client = createClient({
			url: import.meta.env.TURSO_URL,
			authToken: import.meta.env.TURSO_TOKEN,
		})

		const res = await client.execute(
			"SELECT source_name, source, rating, comment FROM reviews WHERE comment IS NOT NULL ORDER BY inserted_at DESC",
		)
		const rows = res.rows as unknown as {
			source_name: string
			source: string
			rating: number
			comment: string | null
		}[]

		// Map numeric rating (1-6) to a short, readable label
		const ratingToWord = (rating: number): string => {
			switch (rating) {
				case 6:
					return "favorite"
				case 5:
					return "loved it"
				case 4:
					return "liked it"
				case 3:
					return "meh'd it"
				case 2:
					return "disliked it"
				case 1:
					return "hated it"
				default:
					return String(rating)
			}
		}

		// Group rows by source
		const groups = rows.reduce(
			(acc, r) => {
				;(acc[r.source] ||= []).push(r)
				return acc
			},
			{} as Record<string, typeof rows>,
		)

		// Desired display order of groups
		const sourceOrder = ["IGDB", "BGG", "TMDB_MOVIE", "TMDB_TV", "SPOTIFY"]

		// Human-friendly headers for each group
		const sourceHeader = (source: string): string => {
			switch (source) {
				case "IGDB":
					return "## Video games (IGDB)"
				case "BGG":
					return "## Board games (BGG)"
				case "TMDB_MOVIE":
					return "## Movies (TMDB)"
				case "TMDB_TV":
					return "## Shows (TMDB)"
				case "SPOTIFY":
					return "## Albums (Spotify)"
				default:
					return source
			}
		}

		const sections: string[] = []
		sourceOrder.forEach((src) => {
			const items = groups[src]
			if (!items?.length) return
			const lines = items
				.map((r) => {
					const comment = r.comment ? ` « ${r.comment} »;` : ";"
					return `${r.source_name} — ${ratingToWord(r.rating)}${comment}`
				})
				.join("\n\n")
			sections.push(`${sourceHeader(src)}\n\n${lines}`)
		})

		const intro = [
			"# Catalogue",
			"",
			"Plain-text catalogue of media I've consumed. Optimized for crawlers, LLMs, and no-JS readers.",
			"",
			"Sources: Video games (IGDB), Board games (BGG), Movies (TMDB), Shows (TMDB), Albums (Spotify).",
		].join("\n")

		const body = [intro, sections.join("\n\n\n")].filter(Boolean).join("\n\n")

		return new Response(body, {
			status: 200,
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Cache-Control": "public, max-age=3600, stale-while-revalidate=1800",
			},
		})
	} catch (err) {
		console.error("GET /catalogue.llm failed:", err)
		return new Response("Unable to load catalogue", {
			status: 500,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		})
	}
}
