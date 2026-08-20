import type { APIContext } from "astro"
import type { Client } from "@libsql/client"
import { getClient } from "$src/db"
import { json } from "$src/apiResponse"
import {
	BODY_LOG_PAGE,
	CREATE_BODY_LOG,
	bearerToken,
	corsHeaders,
	deriveSyncToken,
	parseIncomingEntries,
	preflight,
	safeEqual,
} from "$src/bodyLog"

export const prerender = false // API routes should not be pre-rendered

/**
 * Pages the log from a rowid cursor. Public by design: the tracker's data is
 * as public as the catalogue's, only writes are gated.
 */
export async function GET(
	{ url, request }: APIContext,
	client: Client = getClient(),
): Promise<Response> {
	const cors = corsHeaders(request)
	try {
		const since = Number(url.searchParams.get("since") ?? 0)
		if (!Number.isInteger(since) || since < 0)
			return json({ error: "Bad Request" }, 400, 0, cors)

		// The CREATE rides along so the table self-provisions: this repo has
		// no migration infrastructure to declare it in.
		const [, result, maxResult] = await client.batch([
			CREATE_BODY_LOG,
			{
				sql: "SELECT rowid, entry FROM body_log WHERE rowid > ? ORDER BY rowid LIMIT ?",
				args: [since, BODY_LOG_PAGE],
			},
			// `max` lets a client detect a rebuilt table (rowids restarted
			// below its cursor) and re-pull from scratch.
			"SELECT COALESCE(MAX(rowid), 0) AS max FROM body_log",
		])

		const rows = result.rows as unknown as { rowid: number; entry: string }[]
		const entries = rows.map((row) => JSON.parse(row.entry) as unknown)
		const cursor = rows.length ? Number(rows[rows.length - 1].rowid) : since
		const max = Number((maxResult.rows[0] as unknown as { max: number }).max)
		return json({ entries, cursor, max }, 200, "no-store", cors)
	} catch (err) {
		console.error("GET /api/body/log failed:", err)
		return json({ error: "Failed to fetch log" }, 500, 0, cors)
	}
}

/**
 * Appends pushed entries. INSERT OR IGNORE on the id primary key makes a
 * retried or replayed push idempotent, so the client's outbox can be naive.
 */
export async function POST(
	{ request }: APIContext,
	client: Client = getClient(),
): Promise<Response> {
	const cors = corsHeaders(request)

	let body
	try {
		body = await request.json()
	} catch (err) {
		// Warn, not error: any anonymous caller can trigger this before auth.
		console.warn("POST /api/body/log could not read the body:", err)
		return json({ error: "Bad Request" }, 400, 0, cors)
	}

	try {
		const token = bearerToken(request)
		const expected = deriveSyncToken(
			import.meta.env.BODY_SYNC_SECRET,
			import.meta.env.CATALOGUE_PASSWORD,
		)
		if (!token || !safeEqual(token, expected))
			return json({ error: "Unauthorized" }, 401, 0, cors)

		const entries = parseIncomingEntries(body)
		if (!entries) return json({ error: "Bad Request" }, 400, 0, cors)

		const results = await client.batch([
			CREATE_BODY_LOG,
			...entries.map((entry) => ({
				sql: "INSERT OR IGNORE INTO body_log (id, entry) VALUES (?, ?)",
				args: [entry.id, entry.json],
			})),
		])

		const inserted = results
			.slice(1)
			.reduce((total, result) => total + (result.rowsAffected ?? 0), 0)
		return json({ inserted }, 201, 0, cors)
	} catch (err) {
		console.error("POST /api/body/log failed:", err)
		return json({ error: "Server error" }, 500, 0, cors)
	}
}

export function OPTIONS({ request }: APIContext): Response {
	return preflight(request)
}
