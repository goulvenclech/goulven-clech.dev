import type { Config, Context } from "@netlify/edge-functions"

/**
 * Only here to carry the rate limit below, which Netlify enforces before the
 * SSR function runs.
 */
export default (_request: Request, context: Context) => context.next()

// Must stay above the catalogue MCP's MAX_PAGES, fetched in one burst.
export const config: Config = {
	path: [
		"/catalogue.md",
		"/catalogue/todo.md",
		"/index.md",
		"/api/catalogue/*",
	],
	rateLimit: {
		windowLimit: 120,
		windowSize: 60,
		aggregateBy: ["ip", "domain"],
	},
}
