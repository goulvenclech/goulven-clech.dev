import type { APIContext } from "astro"
import { createClient } from "@libsql/client"
import type { Client } from "@libsql/client"
import { fetchGame, coverUrl } from "./sources/igdb"

/**
 * Reads a mandatory environment variable or throws if it is missing.
 */
function env(key: string): string {
  const value = import.meta.env[key] as string
  if (!value) throw new Error(`Environment variable "${key}" is not set`)
  return value as string
}

const DB_URL = env("TURSO_URL")
const DB_TOKEN = env("TURSO_TOKEN")
const CATALOGUE_PASSWORD = env("CATALOGUE_PASSWORD")

/**
 * Creates a Turso client scoped to the current request.
 * When running in a long‑lived environment, consider memoising this.
 */
function getClient(): Client {
  return createClient({ url: DB_URL, authToken: DB_TOKEN })
}

/**
 * A review helps me keep track of my feelings about a book, movie, or other media.
 * See catalogue.astro and cataloguer.astro for usage.
 */
export interface Review {
  id: string
  source: string
  source_id: string
  source_name: string
  source_link: string
  source_img: string
  rating: number // 1-5
  emotions: number[] // Emotion IDs
  comment: string
  inserted_at: string // ISO-8601
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
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Builds the SELECT query for GET /reviews based on optional filters.
 */
function buildSelectQuery({
  search,
  rating,
  emotion,
  limit,
}: {
  search?: string
  rating?: number
  emotion?: number
  limit: number
}): { sql: string; args: (string | number)[] } {
  const clauses: string[] = []
  const args: (string | number)[] = []

  if (search) {
    clauses.push("(source_name LIKE ? OR comment LIKE ?)")
    const like = `%${search}%`
    args.push(like, like)
  }

  if (typeof rating === "number") {
    clauses.push("rating = ?")
    args.push(rating)
  }

  if (typeof emotion === "number") {
    // Use EXISTS with json_each to check if the emotion id is present in the JSON array
    clauses.push(`EXISTS (
      SELECT 1
        FROM json_each(reviews.emotions) AS e
       WHERE e.value = ?
    )`)
    args.push(emotion)
  }

  let sql = "SELECT * FROM reviews"
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`
  sql += " ORDER BY inserted_at DESC LIMIT ?"
  args.push(limit)

  return { sql, args }
}

export const prerender = false // API routes should not be pre‑rendered

/**
 * Retrieves reviews with optional filters.
 */
export async function GET({ url }: APIContext): Promise<Response> {
  try {
    const search = url.searchParams.get("query")?.trim() || undefined
    const ratingParam = url.searchParams.get("rating")
    const rating = ratingParam ? Number(ratingParam) : undefined
    const emotionParam = url.searchParams.get("emotion")
    const emotion = emotionParam ? Number(emotionParam) : undefined
    const limitParam = url.searchParams.get("limit")
    const limit = limitParam && /^\d+$/.test(limitParam) ? Math.min(Number(limitParam), 100) : 5

    const { sql, args } = buildSelectQuery({ search, rating, emotion, limit })

    const client = getClient()
    const res = await client.execute({ sql, args })
    const reviews = (res.rows as unknown as DbReviewRow[]).map(mapRow)

    return json(reviews)
  } catch (err) {
    console.error("GET /reviews failed:", err)
    return json({ error: "Failed to fetch reviews" }, 500)
  }
}

/**
 * Inserts a new review.
 */
export async function POST({ request }: APIContext): Promise<Response> {
  try {
    const body = await request.json()

    // Basic auth
    if (body?.password !== CATALOGUE_PASSWORD) return json({ error: "Unauthorized" }, 401)

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
      rating <= 5 &&
      Array.isArray(emotions) &&
      emotions.length > 0 &&
      emotions.length <= 3

    if (!isValid) return json({ error: "Bad Request" }, 400)

    // Enrich source metadata (supports IGDB only for now)
    let source_name = ""
    let source_link = ""
    let source_img = ""

    if (source === "IGDB") {
      const game = await fetchGame(Number(source_id))
      if (!game) return json({ error: "Game not found" }, 404)

      const year = new Date(game.first_release_date * 1000).getFullYear()
      source_name = `${game.name} (${year})`
      source_link = `https://www.igdb.com/games/${game.slug}`
      if (game.cover?.image_id) source_img = coverUrl(game.cover.image_id)
    }

    // Insert row
    const client = getClient()
    await client.execute({
      sql: `INSERT INTO reviews
            (source, source_id, source_name, source_link, source_img,
             rating, emotions, comment, inserted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        source,
        source_id,
        source_name,
        source_link,
        source_img,
        rating,
        JSON.stringify(emotions),
        comment,
        date ? new Date(date).toISOString() : new Date().toISOString(),
      ],
    })

    return json({ ok: true }, 201)
  } catch (err) {
    console.error("POST /reviews failed:", err)
    return json({ error: "Server error" }, 500)
  }
}

/**
 * Maintenance tasks on the reviews table (currently: syncIGDB).
 */
export async function PATCH({ request }: APIContext): Promise<Response> {
  try {
    const { password, task } = await request.json()

    if (password !== CATALOGUE_PASSWORD) return json({ error: "Unauthorized" }, 401)
    if (task !== "syncIGDB") return json({ error: "Unknown task" }, 400)

    const client = getClient()

    // 1. Fetch rows missing metadata
    const res = await client.execute({
      sql: `SELECT id, source_id FROM reviews
            WHERE source = 'IGDB'
              AND (source_name IS NULL OR source_name = '')`,
    })

    const rows = res.rows as unknown as { id: string; source_id: string }[]
    let updated = 0

    // 2. Populate metadata via IGDB API
    for (const row of rows) {
      const game = await fetchGame(Number(row.source_id))
      if (!game) continue // skip invalid IDs

      const year = new Date(game.first_release_date * 1000).getFullYear()
      const source_name = `${game.name} (${year})`
      const source_link = `https://www.igdb.com/games/${game.slug}`
      const source_img = game.cover?.image_id ? coverUrl(game.cover.image_id) : ""

      await client.execute({
        sql: `UPDATE reviews SET source_name = ?, source_link = ?, source_img = ? WHERE id = ?`,
        args: [source_name, source_link, source_img, row.id],
      })
      updated++
    }

    return json({ ok: true, updated })
  } catch (err) {
    console.error("PATCH /reviews failed:", err)
    return json({ error: "Server error" }, 500)
  }
}
