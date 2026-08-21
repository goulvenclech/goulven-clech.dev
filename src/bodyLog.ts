import { createHash, createHmac, timingSafeEqual } from "node:crypto"

/**
 * Sync backend for the workout tracker (body.goulven-clech.dev, packages/body).
 * The server only gates writes, dedupes (id PRIMARY KEY), and orders (rowid
 * cursor); entries stay opaque JSON, validated by the client's zod schemas.
 */

const BODY_ORIGINS = [
	"https://body.goulven-clech.dev",
	// Dev and preview servers of packages/body.
	"http://localhost:4322",
	"http://localhost:4323",
]

export function corsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get("origin")
	if (!origin || !BODY_ORIGINS.includes(origin)) return {}
	return { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
}

export function preflight(request: Request): Response {
	return new Response(null, {
		status: 204,
		headers: {
			...corsHeaders(request),
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "authorization, content-type",
			"Access-Control-Max-Age": "86400",
		},
	})
}

/**
 * HMAC over the password with a server-held secret: a leaked token reveals
 * nothing about the shared password, and rotating either the secret or
 * CATALOGUE_PASSWORD revokes every token ever issued — no stored state.
 */
export function deriveSyncToken(secret: string, password: string): string {
	if (!secret) throw new Error("BODY_SYNC_SECRET is not configured")
	return createHmac("sha256", secret)
		.update(`body-sync-v1:${password}`)
		.digest("hex")
}

/** Length-independent comparison: hash both sides before timingSafeEqual. */
export function safeEqual(a: string, b: string): boolean {
	const digest = (value: string) => createHash("sha256").update(value).digest()
	return timingSafeEqual(digest(a), digest(b))
}

export function bearerToken(request: Request): string | null {
	const header = request.headers.get("authorization")
	return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null
}

export const CREATE_BODY_LOG =
	"CREATE TABLE IF NOT EXISTS body_log (id TEXT PRIMARY KEY, entry TEXT NOT NULL)"

/** One page per GET, batch cap per POST; clients pull until cursor reaches max. */
export const BODY_LOG_PAGE = 500

const MAX_ID_LENGTH = 64
const MAX_ENTRY_BYTES = 2048

export interface IncomingEntry {
	id: string
	json: string
}

/**
 * Shape and size gate only — deep validation is the client's job. Rejecting
 * the whole batch on one bad entry keeps a push all-or-nothing.
 */
export function parseIncomingEntries(payload: unknown): IncomingEntry[] | null {
	if (typeof payload !== "object" || payload === null) return null
	const { entries } = payload as { entries?: unknown }
	if (
		!Array.isArray(entries) ||
		entries.length === 0 ||
		entries.length > BODY_LOG_PAGE
	)
		return null

	const parsed: IncomingEntry[] = []
	for (const entry of entries) {
		if (typeof entry !== "object" || entry === null) return null
		const { id } = entry as { id?: unknown }
		if (typeof id !== "string" || id.length === 0 || id.length > MAX_ID_LENGTH)
			return null
		const json = JSON.stringify(entry)
		if (new TextEncoder().encode(json).length > MAX_ENTRY_BYTES) return null
		parsed.push({ id, json })
	}
	return parsed
}
