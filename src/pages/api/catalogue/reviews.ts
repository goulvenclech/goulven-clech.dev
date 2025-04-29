import type { APIContext } from "astro"
import { createClient } from "@libsql/client"

export const prerender = false // API routes should not be pre-rendered

export interface Review {
  id: string
  source: string
  source_id: string
  source_link: string
  source_img: string
  rating: number // 1-5
  emotions: number[] // Emotion IDs
  comment: string
}

interface DbReviewRow extends Omit<Review, "emotions"> {
  emotions: string // JSON stringified array of emotion IDs
}

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
