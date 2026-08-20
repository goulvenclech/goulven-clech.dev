/**
 * Seconds a response may be reused, or `no-store`. `0` omits the header: an
 * error should neither be cached nor claim it forbids caching.
 */
export type CachePolicy = number | "no-store"

export function json(
	payload: unknown,
	status = 200,
	cache: CachePolicy = 0,
	extraHeaders: Record<string, string> = {},
): Response {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...extraHeaders,
	}
	if (cache === "no-store") headers["Cache-Control"] = "no-store"
	// No `immutable`: it would suppress revalidation even on an explicit refresh.
	else if (cache)
		headers["Cache-Control"] =
			`public, max-age=${cache}, stale-while-revalidate=${Math.round(cache / 2)}`

	return new Response(JSON.stringify(payload), { status, headers })
}
