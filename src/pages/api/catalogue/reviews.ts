import type { APIContext } from "astro"
import { createClient } from "@libsql/client"
import { fetchGame, coverUrl } from "./sources/igdb"

export const prerender = false // API routes should not be pre-rendered

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
  inserted_at: string // ISO 8601
}

/**
 * Used as a middleman between the row database datas and the Review interface.
 */
interface DbReviewRow extends Omit<Review, "emotions"> {
  emotions: string // JSON stringified array of emotion IDs
}

/**
 * Used by the catalogue to fetch reviews from the database.
 */
export async function GET(context: APIContext): Promise<Response> {
  try {
    // Get query parameters
    const query = context.url.searchParams.get("query")?.trim() || ""
    const rating = context.url.searchParams.get("rating")?.trim() || ""
    const emotionId = context.url.searchParams.get("emotion")?.trim() || ""

    const client = createClient({
      url: import.meta.env.TURSO_URL,
      authToken: import.meta.env.TURSO_TOKEN,
    })

    // Build query with conditionals
    let sql = "SELECT * FROM reviews"
    const conditions = []
    const params: any[] = []

    // Add query parameter for text search
    if (query) {
      conditions.push("(source_id LIKE ? OR comment LIKE ?)")
      params.push(`%${query}%`, `%${query}%`)
    }

    // Add rating filter
    if (rating) {
      conditions.push("rating = ?")
      params.push(rating)
    }

    // Add WHERE clause if we have conditions
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ")
    }

    // Add order by inserted_at in descending order (newest first)
    sql += " ORDER BY inserted_at DESC"

    // Execute the main query
    const res = await client.execute({ sql, args: params })
    let reviews = (res.rows as unknown as DbReviewRow[]).map((row) => ({
      ...row,
      emotions: JSON.parse(row.emotions ?? "[]") as number[],
    }))

    // Filter by emotion ID if specified (needs post-processing since emotions is JSON)
    if (emotionId) {
      reviews = reviews.filter((review) => review.emotions.some((id) => String(id) === emotionId))
    }

    return new Response(JSON.stringify(reviews), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Failed to fetch reviews:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch reviews" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}

/**
 * Used by the cataloguer to insert a new review into the database.
 */
export async function POST({ request }: APIContext): Promise<Response> {
  try {
    const {
      password,
      date, // "YYYY-MM-DD" from <input type="date">
      source,
      source_id,
      rating,
      emotions, // number[]
      comment = "",
    } = await request.json()

    // Basic authentication
    if (password !== import.meta.env.CATALOGUE_PASSWORD) {
      // wrong password → 401
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Validate inputs
    if (
      !source ||
      !source_id ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      !Array.isArray(emotions) ||
      emotions.length === 0 ||
      emotions.length > 3
    ) {
      return new Response(JSON.stringify({ error: "Bad Request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    let source_name = ""
    let source_link = ""
    let source_img = ""

    if (source === "IGDB") {
      const game = await fetchGame(Number(source_id))

      if (!game) {
        return new Response(JSON.stringify({ error: "Game not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      }

      const year = new Date(game.first_release_date * 1000).getFullYear()
      source_name = `${game.name} (${year})`
      source_link = `https://www.igdb.com/games/${game.slug}`
      if (game.cover?.image_id) {
        source_img = coverUrl(game.cover.image_id)
      }
    }

    const client = createClient({
      url: import.meta.env.TURSO_URL,
      authToken: import.meta.env.TURSO_TOKEN,
    })

    const insertedAt = date ? new Date(date).toISOString() : new Date().toISOString()

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
        insertedAt,
      ],
    })

    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Failed to insert review:", err)
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

/**
 * Used to perform maintenance tasks on the reviews database
 * Currently supports: syncIGDB - updates missing game metadata
 */
export async function PATCH({ request }: APIContext): Promise<Response> {
  try {
    const { password, task } = await request.json()

    // Reuse the same admin password as the POST endpoint
    if (password !== import.meta.env.CATALOGUE_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (task !== "syncIGDB") {
      return new Response(JSON.stringify({ error: "Unknown task" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const client = createClient({
      url: import.meta.env.TURSO_URL,
      authToken: import.meta.env.TURSO_TOKEN,
    })

    // 1. Get all IDs with empty metadata
    const res = await client.execute({
      sql: `SELECT id, source_id FROM reviews
            WHERE source = 'IGDB'
              AND (source_name IS NULL OR source_name = '')`,
    })

    const rows = res.rows as unknown as { id: string; source_id: string }[]
    let updated = 0

    // 2. For each review, populate the missing fields via IGDB API
    for (const row of rows) {
      const game = await fetchGame(Number(row.source_id))
      if (!game) continue // skip if ID is invalid

      const year = new Date(game.first_release_date * 1000).getFullYear()
      const source_name = `${game.name} (${year})`
      const source_link = `https://www.igdb.com/games/${game.slug}`
      const source_img = game.cover?.image_id ? coverUrl(game.cover.image_id) : ""

      await client.execute({
        sql: `UPDATE reviews
              SET source_name = ?, source_link = ?, source_img = ?
              WHERE id = ?`,
        args: [source_name, source_link, source_img, row.id],
      })
      updated++
    }

    return new Response(JSON.stringify({ ok: true, updated }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Sync IGDB error:", err)
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
