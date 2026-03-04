/**
 * Extracts image dimensions from an Amazon CDN URL.
 *
 * Amazon product images use `_SL{n}_` suffixes to indicate the maximum side
 * length in pixels. Because the constraint applies to the longest side, the
 * actual aspect ratio is unknown — we return a square bounding box so Astro
 * can skip the remote `inferSize` fetch.
 */
export function parseAmazonImageSize(
	url: string,
): { width: number; height: number } | undefined {
	const match = url.match(/_SL(\d+)_/)
	if (!match) return undefined

	const size = Number(match[1])
	if (!Number.isFinite(size) || size <= 0) return undefined

	return { width: size, height: size }
}
