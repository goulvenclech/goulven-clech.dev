import type { APIContext } from "astro"

/** Set by every catalogue reader, purged on write. */
export const CATALOGUE_CACHE_TAG = "catalogue"

const MAX_AGE = 3600
const STALE_WHILE_REVALIDATE = 86400

/**
 * Call once the data is loaded: the provider stamps whatever response
 * follows, an error included.
 */
export function cacheAtEdge(
	context: APIContext,
	options: { tags?: string[]; params?: readonly string[] } = {},
): Record<string, string> {
	context.cache.set({
		maxAge: MAX_AGE,
		swr: STALE_WHILE_REVALIDATE,
		tags: options.tags ?? [],
	})
	// Netlify keys on the whole query string unless told which parameters
	// matter; a name nobody reads pools every request into one object.
	const params = options.params?.length ? options.params : ["none"]
	return { "Netlify-Vary": `query=${params.join("|")}` }
}
