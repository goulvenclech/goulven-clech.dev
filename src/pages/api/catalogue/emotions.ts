import type { APIContext } from "astro"
import { createClient } from "@libsql/client"

export const prerender = false // API routes should not be pre-rendered

export interface Emotion {
	id: string
	emoji: string
	name: string
	is_deleted: boolean
}

export async function GET(_context: APIContext): Promise<Response> {
	try {
		const client = createClient({
			url: import.meta.env.TURSO_URL,
			authToken: import.meta.env.TURSO_TOKEN,
		})

		const emotions = await client.execute(
			"SELECT * FROM emotions WHERE is_deleted = false",
		)
		const emotionsRows = emotions.rows as unknown as Emotion[]

		return new Response(JSON.stringify(emotionsRows), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=86400, immutable", // 24h cache
			},
		})
	} catch (error) {
		console.error("Failed to fetch emotions:", error)
		return new Response(JSON.stringify({ error: "Failed to fetch emotions" }), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		})
	}
}
