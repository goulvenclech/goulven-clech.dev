import type { APIContext } from "astro"
import type { Client } from "@libsql/client"
import { getClient } from "$src/db"
import { json } from "$src/apiResponse"
import {
	buildSelectQuery,
	parseReviewQuery,
} from "$src/catalogue/reviewQueries"
import { sourceResolvers } from "$src/catalogue/sources/resolvers"
import type { Review } from "$src/catalogue/apiTypes"

/**
 * Raw row as stored in the database. The query selects every column, so a row
 * can carry more than this declares.
 */
interface DbReviewRow extends Omit<Review, "emotions"> {
	emotions: string // JSON‑encoded array of emotion IDs
}

/**
 * Projected field by field rather than spread, so widening the table can't
 * silently widen the API response.
 */
const mapRow = (row: DbReviewRow): Review => ({
	id: row.id,
	source: row.source,
	source_id: row.source_id,
	source_name: row.source_name,
	source_link: row.source_link,
	source_img: row.source_img,
	rating: row.rating,
	emotions: JSON.parse(row.emotions ?? "[]") as number[],
	comment: row.comment,
	inserted_at: row.inserted_at,
	meta: row.meta,
})

export const prerender = false // API routes should not be pre-rendered

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
	// Parsed outside the main try so a malformed body is a 400, not a 500.
	let body
	try {
		body = await request.json()
	} catch (err) {
		// Warn, not error: any anonymous caller can trigger this before auth.
		console.warn("POST /reviews could not read the body:", err)
		return json({ error: "Bad Request" }, 400)
	}

	try {
		// Basic auth
		if (body?.password !== import.meta.env.CATALOGUE_PASSWORD)
			return json({ error: "Unauthorized" }, 401)

		// Validation
		const {
			date,
			source,
			source_id: rawSourceId,
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

		// Trim so a stray space can't reach the DB; the to-do page matches on this id.
		const source_id =
			typeof rawSourceId === "string" ? rawSourceId.trim() : rawSourceId

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

		await client.execute({
			sql: `INSERT INTO reviews
            (source, source_id, source_name, source_link, source_img,
             rating, emotions, comment, meta, inserted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				source,
				source_id,
				resolved.source_name,
				resolved.source_link,
				resolved.source_img,
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
