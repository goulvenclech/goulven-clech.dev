import type { APIContext } from "astro"
import type { Client } from "@libsql/client"
import { getClient } from "$src/db"
import { json } from "$src/apiResponse"

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

		// Emotions rarely change, but a new one should land without a long wait.
		return json(emotionsRows, 200, 3600)
	} catch (error) {
		console.error("Failed to fetch emotions:", error)
		return json({ error: "Failed to fetch emotions" }, 500)
	}
}
