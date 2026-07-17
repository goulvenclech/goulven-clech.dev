import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import sharp from "sharp"
// @ts-ignore - Please EleventyFetch type your shit 🙏
import EleventyFetch from "@11ty/eleventy-fetch"
import {
	resolveRedirectChain,
	clearRedirectCache,
	probeImageSize,
	clearImageSizeCache,
} from "../src/imageUtils"

vi.mock("@11ty/eleventy-fetch", () => ({ default: vi.fn() }))
const eleventyFetchMock = EleventyFetch as unknown as Mock

beforeEach(() => {
	clearRedirectCache()
	clearImageSizeCache()
	vi.restoreAllMocks()
	eleventyFetchMock.mockReset()
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

function pngBuffer(width: number, height: number): Promise<Buffer> {
	return sharp({
		create: { width, height, channels: 3, background: "#fff" },
	})
		.png()
		.toBuffer()
}

describe("probeImageSize", () => {
	it("returns the real pixel dimensions of the fetched image", async () => {
		eleventyFetchMock.mockResolvedValueOnce(await pngBuffer(120, 180))

		const size = await probeImageSize("https://example.com/cover.png")

		expect(size).toEqual({ width: 120, height: 180 })
		expect(eleventyFetchMock).toHaveBeenCalledWith(
			"https://example.com/cover.png",
			{
				duration: "1d",
				type: "buffer",
			},
		)
	})

	it("reports EXIF-rotated JPEGs as browsers display them", async () => {
		const rotated = await sharp({
			create: { width: 40, height: 30, channels: 3, background: "#fff" },
		})
			.jpeg()
			.withMetadata({ orientation: 6 })
			.toBuffer()
		eleventyFetchMock.mockResolvedValueOnce(rotated)

		const size = await probeImageSize("https://example.com/rotated.jpg")

		expect(size).toEqual({ width: 30, height: 40 })
	})

	it("returns null when the fetch fails", async () => {
		eleventyFetchMock.mockRejectedValueOnce(new Error("HTTP 404"))

		const size = await probeImageSize("https://example.com/missing.png")

		expect(size).toBeNull()
	})

	it("returns null when the payload is not an image", async () => {
		eleventyFetchMock.mockResolvedValueOnce(Buffer.from("nope"))

		const size = await probeImageSize("https://example.com/not-an-image")

		expect(size).toBeNull()
	})

	it("uses the cache on subsequent calls for the same URL", async () => {
		eleventyFetchMock.mockResolvedValueOnce(await pngBuffer(30, 40))

		await probeImageSize("https://example.com/cached.png")
		const size = await probeImageSize("https://example.com/cached.png")

		expect(size).toEqual({ width: 30, height: 40 })
		expect(eleventyFetchMock).toHaveBeenCalledTimes(1)
	})
})
