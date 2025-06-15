import type { APIContext } from "astro"
import { createClient } from "@libsql/client"
import type { Client } from "@libsql/client"
import { env } from "src/utils"

const DB_URL = env("TURSO_URL")
const DB_TOKEN = env("TURSO_TOKEN")

function getClient(): Client {
  return createClient({ url: DB_URL, authToken: DB_TOKEN })
}

export interface Day {
  date: string          // ISO yyyy-mm-dd
  steps: number | null
  sleep: number | null  // hours
  energy: number | null // 0-100
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export const prerender = false // API routes are dynamic

export async function GET({ url }: APIContext): Promise<Response> {
  try {
    const monthParam = url.searchParams.get("month") // optional
    let year: number, month: number // month = 0-11

    if (monthParam) {
      const match = /^(\d{4})-(\d{2})$/.exec(monthParam)
      if (!match) return json({ error: "Bad month format (expected YYYY-MM)" }, 400)
      year = Number(match[1])
      month = Number(match[2]) - 1
    } else {
      const now = new Date()
      year = now.getFullYear()
      month = now.getMonth()
    }

    const start = new Date(year, month, 1).toISOString().slice(0, 10)      // yyyy-mm-dd
    const end   = new Date(year, month + 1, 0).toISOString().slice(0, 10)  // yyyy-mm-dd

    const client = getClient()
    const res = await client.execute({
      sql: `SELECT day, steps, sleep_hours, energy
              FROM health
             WHERE day BETWEEN ? AND ?
          ORDER BY day ASC`,
      args: [start, end],
    })

    const days: Day[] = res.rows.map((r: any) => ({
      date: r.day,
      steps: r.steps ?? null,
      sleep: r.sleep_hours ?? null,
      energy: r.energy ?? null,
    }))

    return json({ days }, 200)
  } catch (err) {
    console.error("GET /health failed:", err)
    return json({ error: "Server error" }, 500)
  }
}
