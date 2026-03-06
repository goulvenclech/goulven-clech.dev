const redirectCache = new Map<string, string>()

/**
 * Follows a URL's redirect chain and returns the final destination URL.
 * Results are cached in memory to avoid redundant network requests during build.
 */
export async function resolveRedirectChain(url: string): Promise<string> {
	const cached = redirectCache.get(url)
	if (cached !== undefined) return cached

	const response = await fetch(url, { method: "HEAD", redirect: "follow" })
	response.body?.cancel()

	const finalUrl = response.url
	redirectCache.set(url, finalUrl)
	return finalUrl
}

/** Exposed for testing only — clears the redirect cache. */
export function clearRedirectCache(): void {
	redirectCache.clear()
}
