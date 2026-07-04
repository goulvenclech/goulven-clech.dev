import type { APIContext } from "astro"
import type { Client } from "@libsql/client"
import { getClient } from "$src/db"
import { computeImageFocusY } from "../../../imageFocus"
import { buildSelectQuery, parseReviewQuery } from "./reviewQueries"
import { sourceResolvers } from "./sourceResolver"

/**
 * A review helps me keep track of my feelings about a book, movie, or other media.
 * See catalogue.astro and catalogue/new.astro for usage.
 */
export interface Review {
	id: string
	source: string
	source_id: string
	source_name: string
	source_link: string
	source_img: string
	source_img_focus_y: number | null
	rating: number // 1-6
	emotions: number[] // Emotion IDs
	comment: string
	inserted_at: string // ISO-8601
	meta: string
}

/**
 * Raw row as stored in the database.
 */
interface DbReviewRow extends Omit<Review, "emotions"> {
	emotions: string // JSON‑encoded array of emotion IDs
}

/**
 * Maps a DB row to the public Review shape.
 */
const mapRow = (row: DbReviewRow): Review => ({
	...row,
	emotions: JSON.parse(row.emotions ?? "[]") as number[],
})

/**
 * Returns a JSON response with the given status.
 */
function json(payload: unknown, status = 200, cacheSeconds = 0): Response {
	const headers: Record<string, string> = { "Content-Type": "application/json" }
	if (cacheSeconds)
		headers["Cache-Control"] =
			`public, max-age=${cacheSeconds}, stale-while-revalidate=${Math.round(cacheSeconds / 2)}`

	return new Response(JSON.stringify(payload), { status, headers })
}

export const prerender = false // API routes should not be pre‑rendered

/**
 * Retrieves reviews with optional filters.
 */
export async function GET(
	{ url }: APIContext,
	client: Client = getClient(),
): Promise<Response> {
	try {
		const { filters, limit, offset } = parseReviewQuery(url, 5)

		const { sql, args } = buildSelectQuery({
			...filters,
			limit: limit + 1, // Get one extra row to check for "hasMore"
			offset,
		})

		const res = await client.execute({ sql, args })
		const rows = res.rows as unknown as DbReviewRow[]

		const hasMore = rows.length > limit
		const reviews = rows.slice(0, limit).map(mapRow)

		return json({ reviews, hasMore }, 200, 60) // 1 min cache
	} catch (err) {
		console.error("GET /reviews failed:", err)
		return json({ error: "Failed to fetch reviews" }, 500)
	}
}

/**
 * Inserts a new review.
 */
export async function POST(
	{ request }: APIContext,
	client: Client = getClient(),
): Promise<Response> {
	try {
		const body = await request.json()

		// Basic auth
		if (body?.password !== import.meta.env.CATALOGUE_PASSWORD)
			return json({ error: "Unauthorized" }, 401)

		// Validation
		const {
			date,
			source,
			source_id,
			rating,
			emotions,
			comment = "",
		}: {
			date?: string
			source: string
			source_id: string
			rating: number
			emotions: number[]
			comment?: string
		} = body

		const isValid =
			source &&
			source_id &&
			Number.isInteger(rating) &&
			rating >= 1 &&
			rating <= 6 &&
			Array.isArray(emotions) &&
			emotions.length > 0 &&
			emotions.length <= 3

		if (!isValid) return json({ error: "Bad Request" }, 400)

		const resolver = sourceResolvers[source]
		if (!resolver) return json({ error: "Unsupported source" }, 400)

		const resolved = await resolver(source_id)
		if (!resolved) return json({ error: "Not found" }, 404)

		const source_img_focus_y = resolved.source_img
			? await computeImageFocusY(resolved.source_img)
			: null

		await client.execute({
			sql: `INSERT INTO reviews
            (source, source_id, source_name, source_link, source_img, source_img_focus_y,
             rating, emotions, comment, meta, inserted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				source,
				source_id,
				resolved.source_name,
				resolved.source_link,
				resolved.source_img,
				source_img_focus_y,
				rating,
				JSON.stringify(emotions),
				comment,
				resolved.meta,
				date ? new Date(date).toISOString() : new Date().toISOString(),
			],
		})

		return json({ ok: true }, 201)
	} catch (err) {
		console.error("POST /reviews failed:", err)
		return json({ error: "Server error" }, 500)
	}
}
