import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolveRedirectChain, clearRedirectCache } from "../src/imageUtils"

beforeEach(() => {
	clearRedirectCache()
	vi.restoreAllMocks()
})

describe("resolveRedirectChain", () => {
	it("returns the same URL when there is no redirect", async () => {
		const url = "https://example.com/image.jpg"
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
			url,
			body: { cancel: vi.fn() },
		} as unknown as Response)

		const result = await resolveRedirectChain(url)

		expect(result).toBe(url)
		expect(fetch).toHaveBeenCalledWith(url, {
			method: "HEAD",
			redirect: "follow",
		})
	})

	it("returns the final URL after redirects", async () => {
		const originalUrl = "https://covers.openlibrary.org/b/isbn/123-L.jpg"
		const finalUrl = "https://ia800100.us.archive.org/image.jpg"
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
			url: finalUrl,
			body: { cancel: vi.fn() },
		} as unknown as Response)

		const result = await resolveRedirectChain(originalUrl)

		expect(result).toBe(finalUrl)
	})

	it("uses the cache on subsequent calls for the same URL", async () => {
		const url = "https://covers.openlibrary.org/b/isbn/456-L.jpg"
		const finalUrl = "https://ia600200.us.archive.org/image.jpg"
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
			url: finalUrl,
			body: { cancel: vi.fn() },
		} as unknown as Response)

		await resolveRedirectChain(url)
		const result = await resolveRedirectChain(url)

		expect(result).toBe(finalUrl)
		expect(fetchSpy).toHaveBeenCalledTimes(1)
	})
})
