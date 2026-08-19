import type { APIContext } from "astro"
import { LibsqlError } from "@libsql/client"
import { BODY_PASSWORD } from "astro:env/server"
import { getClient, type Client } from "$src/db"
import { json } from "$src/apiResponse"
import { localDateOf } from "$src/dates"
import { parseSessionPayload } from "$src/sessionValidation"
import {
	getSessionByDate,
	insertSession,
	listSessions,
	listSetsForSessions,
} from "$src/queries"

/**
 * Lists logged sessions, most recent first, each with its sets. Pages query
 * the database directly; this is the programmatic read surface for agents and
 * tooling.
 */
export async function GET(
	{ url }: APIContext,
	client: Client = getClient(),
): Promise<Response> {
	try {
		const limitParam = Number(url.searchParams.get("limit") ?? "30")
		const offsetParam = Number(url.searchParams.get("offset") ?? "0")
		const limit =
			Number.isInteger(limitParam) && limitParam >= 1 && limitParam <= 100
				? limitParam
				: 30
		const offset =
			Number.isInteger(offsetParam) && offsetParam >= 0 ? offsetParam : 0

		const rows = await listSessions(client, limit + 1, offset)
		const hasMore = rows.length > limit
		const page = rows.slice(0, limit)
		const sets = await listSetsForSessions(
			client,
			page.map((session) => session.id),
		)

		const sessions = page.map((session) => ({
			...session,
			sets: sets
				.filter((set) => set.session_id === session.id)
				.map((set) => ({
					exercise: set.exercise,
					pattern: set.pattern,
					weight_kg: set.weight_kg,
					reps: set.reps,
					set_index: set.set_index,
				})),
		}))

		return json({ sessions, hasMore }, 200, 60)
	} catch (err) {
		console.error("GET /api/sessions failed:", err)
		return json({ error: "Failed to fetch sessions" }, 500)
	}
}

/**
 * Logs the session of a day: confirmed (with optional sets) or skipped.
 */
export async function POST(
	{ request }: APIContext,
	client: Client = getClient(),
): Promise<Response> {
	// Parsed outside the main try so a malformed body is a 400, not a 500.
	let body: unknown
	try {
		body = await request.json()
	} catch (err) {
		// Warn, not error: any anonymous caller can trigger this before auth.
		console.warn("POST /api/sessions could not read the body:", err)
		return json({ error: "Bad Request" }, 400)
	}

	try {
		const password =
			typeof body === "object" && body !== null
				? (body as Record<string, unknown>).password
				: undefined
		if (password !== BODY_PASSWORD) return json({ error: "Unauthorized" }, 401)

		const parsed = parseSessionPayload(body, localDateOf(new Date()))
		if (!parsed.ok) return json({ error: parsed.error }, 400)

		if (await getSessionByDate(client, parsed.session.date))
			return json({ error: "A session is already logged for this date" }, 409)

		const id = await insertSession(client, parsed.session)
		return json({ ok: true, id }, 201)
	} catch (err) {
		// The pre-insert check can race a concurrent insert; the UNIQUE
		// constraint on sessions.date is the real arbiter, so report its
		// violation as the same conflict rather than a server error.
		if (
			err instanceof LibsqlError &&
			err.code.startsWith("SQLITE_CONSTRAINT") &&
			err.message.includes("UNIQUE constraint failed: sessions.date")
		)
			return json({ error: "A session is already logged for this date" }, 409)
		console.error("POST /api/sessions failed:", err)
		return json({ error: "Server error" }, 500)
	}
}
