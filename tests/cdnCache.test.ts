import { describe, it, expect } from "vitest"
import { cacheAtEdge, CATALOGUE_CACHE_TAG } from "../src/cdnCache"
import { createMockAPIContext } from "./helpers"

describe("cacheAtEdge", () => {
	it("asks the CDN for an hour of freshness and a day of stale-while-revalidate", () => {
		const context = createMockAPIContext()
		cacheAtEdge(context, { tags: [CATALOGUE_CACHE_TAG] })
		expect(context.cache.set).toHaveBeenCalledWith({
			maxAge: 3600,
			swr: 86400,
			tags: [CATALOGUE_CACHE_TAG],
		})
	})

	it("narrows the cache key to the listed query parameters", () => {
		const headers = cacheAtEdge(createMockAPIContext(), {
			params: ["list", "items"],
		})
		expect(headers).toEqual({ "Netlify-Vary": "query=list|items" })
	})

	it("pins a route without parameters to a single cache object", () => {
		const headers = cacheAtEdge(createMockAPIContext())
		expect(headers["Netlify-Vary"]).toMatch(/^query=[^|,\s]+$/)
	})
})
