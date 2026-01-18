import type { APIContext } from "astro"
import { createClient } from "@libsql/client"
import type { Client } from "@libsql/client"

function getClient(): Client {
	return createClient({
		url: import.meta.env.TURSO_URL,
		authToken: import.meta.env.TURSO_TOKEN,
	})
}

export interface Day {
	date: string // ISO yyyy-mm-dd
	steps: number | null
	sleep: number | null // hours
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
			if (!match)
				return json({ error: "Bad month format (expected YYYY-MM)" }, 400)
			year = Number(match[1])
			month = Number(match[2]) - 1
		} else {
			const now = new Date()
			year = now.getFullYear()
			month = now.getMonth()
		}

		const startDate = new Date(year, month, 1)
		const endDate = new Date(year, month + 1, 0)
		// Format dates as YYYY-MM-DD, avoiding timezone issues
		const start = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, "0")}-${startDate.getDate().toString().padStart(2, "0")}`
		const end = `${endDate.getFullYear()}-${(endDate.getMonth() + 1).toString().padStart(2, "0")}-${endDate.getDate().toString().padStart(2, "0")}`

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

		// Check if there's data in previous months
		const prevMonthEnd = new Date(year, month, 0).toISOString().slice(0, 10)
		const hasMoreRes = await client.execute({
			sql: `SELECT 1 FROM health WHERE day <= ? LIMIT 1`,
			args: [prevMonthEnd],
		})
		const hasMore = hasMoreRes.rows.length > 0

		return json({ days, hasMore }, 200)
	} catch (err) {
		console.error("GET /health failed:", err)
		return json({ error: "Server error" }, 500)
	}
}
