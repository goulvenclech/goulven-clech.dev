import type { APIContext } from "astro"
import type { Client } from "@libsql/client"
import { getClient } from "$src/db"

export const prerender = false // API routes should not be pre-rendered

export interface Emotion {
	id: number
	emoji: string
	name: string
}

export async function GET(
	_context: APIContext,
	client: Client = getClient(),
): Promise<Response> {
	try {
		const emotions = await client.execute(
			"SELECT id, emoji, name FROM emotions WHERE is_deleted = false",
		)
		// Project in code too, so internal columns can't leak if the query widens.
		const emotionsRows = (emotions.rows as unknown as Emotion[]).map(
			({ id, emoji, name }) => ({ id, emoji, name }),
		)

		return new Response(JSON.stringify(emotionsRows), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				// No `immutable`: it would suppress revalidation even on a refresh.
				"Cache-Control": "public, max-age=3600, stale-while-revalidate=1800",
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
