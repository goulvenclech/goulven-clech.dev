import { describe, it, expect } from "vitest"
import { json } from "../src/apiResponse"

describe("json", () => {
	it("serialises the payload and answers 200 by default", async () => {
		const res = json({ hello: "world" })
		expect(res.status).toBe(200)
		expect(res.headers.get("Content-Type")).toBe("application/json")
		expect(await res.json()).toEqual({ hello: "world" })
	})

	it("passes the status through", () => {
		expect(json({ error: "Not found" }, 404).status).toBe(404)
	})

	it("omits the cache header entirely when no policy is given", () => {
		expect(json({ error: "boom" }, 500).headers.get("Cache-Control")).toBeNull()
	})

	it("revalidates in the background at half the freshness window", () => {
		expect(json([], 200, 3600).headers.get("Cache-Control")).toBe(
			"public, max-age=3600, stale-while-revalidate=1800",
		)
	})

	it("never marks a response immutable, which would defeat revalidation", () => {
		expect(json([], 200, 60).headers.get("Cache-Control")).not.toContain(
			"immutable",
		)
	})

	it("supports no-store for data that must be read live", () => {
		expect(json([], 200, "no-store").headers.get("Cache-Control")).toBe(
			"no-store",
		)
	})
})
