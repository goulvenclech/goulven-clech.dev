import type { APIContext } from "astro"
import type { Client } from "@libsql/client"
import { getClient } from "$src/db"
import { json } from "$src/apiResponse"

export const prerender = false // API routes should not be pre-rendered

/** Distinct days (`yyyy-mm-dd`, UTC) that already carry a review. */
export async function GET(
	_context: APIContext,
	client: Client = getClient(),
): Promise<Response> {
	try {
		const res = await client.execute(
			"SELECT DISTINCT substr(inserted_at, 1, 10) AS day FROM reviews",
		)
		const days = (res.rows as unknown as { day: string }[]).map(
			(row) => row.day,
		)

		// No cache: the form reads this live to avoid reusing an existing day.
		return json(days, 200, "no-store")
	} catch (error) {
		console.error("Failed to fetch review dates:", error)
		return json({ error: "Failed to fetch dates" }, 500)
	}
}
