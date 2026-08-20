import type { APIContext } from "astro"
import { json } from "$src/apiResponse"
import {
	corsHeaders,
	deriveSyncToken,
	preflight,
	safeEqual,
} from "$src/bodyLog"

export const prerender = false // API routes should not be pre-rendered

/** Exchanges the shared password for the sync token, typed once per browser. */
export async function POST({ request }: APIContext): Promise<Response> {
	const cors = corsHeaders(request)

	// Parsed outside the main try so a malformed body is a 400, not a 500.
	let body
	try {
		body = await request.json()
	} catch (err) {
		// Warn, not error: any anonymous caller can trigger this before auth.
		console.warn("POST /api/body/auth could not read the body:", err)
		return json({ error: "Bad Request" }, 400, 0, cors)
	}

	try {
		const password = (body as { password?: unknown })?.password
		if (
			typeof password !== "string" ||
			!safeEqual(password, import.meta.env.CATALOGUE_PASSWORD)
		)
			return json({ error: "Unauthorized" }, 401, 0, cors)

		return json(
			{
				token: deriveSyncToken(
					import.meta.env.BODY_SYNC_SECRET,
					import.meta.env.CATALOGUE_PASSWORD,
				),
			},
			200,
			"no-store",
			cors,
		)
	} catch (err) {
		console.error("POST /api/body/auth failed:", err)
		return json({ error: "Server error" }, 500, 0, cors)
	}
}

export function OPTIONS({ request }: APIContext): Response {
	return preflight(request)
}
