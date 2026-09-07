import { describe, it, expect, vi } from "vitest"
import type { Context } from "@netlify/edge-functions"
import handler, { config } from "../netlify/edge-functions/rate-limit"
import { MAX_PAGES } from "../packages/catalogue-mcp/src/catalogue"

describe("rate-limit edge function", () => {
	it("passes every request through untouched", async () => {
		const next = vi.fn(async () => new Response("ok"))
		const res = await handler(new Request("https://example.com/catalogue.md"), {
			next,
		} as unknown as Context)
		expect(next).toHaveBeenCalledOnce()
		expect(await res.text()).toBe("ok")
	})

	it("leaves the catalogue MCP's paging burst within one window", () => {
		expect(config.rateLimit?.windowLimit).toBeGreaterThan(MAX_PAGES)
		expect(config.rateLimit?.aggregateBy).toContain("ip")
	})
})
