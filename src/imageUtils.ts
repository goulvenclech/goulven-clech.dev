// @ts-ignore - Please EleventyFetch type your shit 🙏
import EleventyFetch from "@11ty/eleventy-fetch"
import sharp from "sharp"

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

export interface ImageSize {
	width: number
	height: number
}

const imageSizeCache = new Map<string, ImageSize | null>()

/**
 * Fetches a remote image and reads its real pixel dimensions.
 * Images render at their natural aspect ratio, so a wrong ratio shifts the
 * layout once the file loads — guessed dimensions are only safe as fallbacks.
 * Backed by EleventyFetch's disk cache; the in-memory map dedupes per build.
 */
export async function probeImageSize(url: string): Promise<ImageSize | null> {
	const cached = imageSizeCache.get(url)
	if (cached !== undefined) return cached

	let size: ImageSize | null = null
	try {
		const buffer: Buffer = await EleventyFetch(url, {
			duration: "1d",
			type: "buffer",
		})
		const metadata = await sharp(buffer).metadata()
		// autoOrient reports the dimensions as browsers will display them,
		// with EXIF rotation applied (width/height swapped for orientations 5-8).
		const { width, height } = metadata.autoOrient ?? metadata
		if (width && height) size = { width, height }
	} catch (error) {
		console.warn("Failed to probe image size:", url, error)
	}
	imageSizeCache.set(url, size)
	return size
}

/** Exposed for testing only — clears the image size cache. */
export function clearImageSizeCache(): void {
	imageSizeCache.clear()
}
