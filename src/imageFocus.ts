import sharp from "sharp"

/**
 * Computes the vertical focus point of an image by scanning a sliding horizontal
 * window and picking the position with the highest entropy. Returns the
 * percentage (0-100) from the top where the most visually "interesting" area lies.
 *
 * Notes:
 * - The image is resized to a manageable width to keep CPU/memory in check.
 * - The sliding window height is capped at 50px to balance speed vs accuracy.
 */
export async function computeImageFocusY(url: string): Promise<number | null> {
	try {
		const res = await fetch(url)
		if (!res.ok) {
			console.error("Failed to fetch image:", res.statusText)
			return null
		}
		const buffer = Buffer.from(await res.arrayBuffer())

		// Resize to a manageable width, convert to greyscale and apply a slight Gaussian blur
		// to denoise before computing Sobel gradients (stabilizes the energy profile).
		const grey = sharp(buffer)
			.resize({ width: 256, withoutEnlargement: true })
			.greyscale()
			.blur(1.2)

		// Compute Sobel X and Y with an offset to preserve sign in 8-bit (we'll subtract later)
		const sobelX = {
			width: 3,
			height: 3,
			kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1],
			scale: 1,
			offset: 128 as const,
		}
		const sobelY = {
			width: 3,
			height: 3,
			kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1],
			scale: 1,
			offset: 128 as const,
		}

		const [{ data: gx, info: gxInfo }, { data: gy, info: gyInfo }] =
			await Promise.all([
				grey
					.clone()
					.convolve(sobelX)
					.raw()
					.toBuffer({ resolveWithObject: true }),
				grey
					.clone()
					.convolve(sobelY)
					.raw()
					.toBuffer({ resolveWithObject: true }),
			])

		const width = gxInfo.width
		const height = gxInfo.height
		if (!width || !height) {
			console.error("Failed to retrieve image metadata")
			return null
		}
		// Sanity check dim/channel match
		if (
			gyInfo.width !== width ||
			gyInfo.height !== height ||
			gxInfo.channels !== 1 ||
			gyInfo.channels !== 1
		) {
			console.error("Unexpected gradient buffers shape")
			return null
		}

		// Build an edge energy map and a row-wise energy profile
		const n = width * height
		const rowEnergy = new Float64Array(height)
		const energyPixels = new Uint8Array(n) // for optional debug image
		let maxMag = 1
		for (let i = 0; i < n; i++) {
			// Recover signed gradient by removing offset
			const gxv = (gx[i] as number) - 128
			const gyv = (gy[i] as number) - 128
			const mag = Math.hypot(gxv, gyv)
			if (mag > maxMag) maxMag = mag
			const y = (i / width) | 0
			rowEnergy[y] += mag
		}
		// Normalize energy map to 0..255 for debug export
		for (let i = 0; i < n; i++) {
			const gxv = (gx[i] as number) - 128
			const gyv = (gy[i] as number) - 128
			const mag = Math.hypot(gxv, gyv)
			energyPixels[i] = Math.min(255, Math.round((mag / maxMag) * 255))
		}

		// Sliding-window parameters
		const slidingWindowHeight = Math.min(50, height)
		const slidingStep = 5

		let bestTop = 0
		let bestScore = -Infinity

		// Ensure we evaluate the last possible window that touches the bottom
		const lastTop = Math.max(0, height - slidingWindowHeight)

		// Use a prefix-sum for O(1) window sum
		const prefix = new Float64Array(height + 1)
		for (let y = 0; y < height; y++) prefix[y + 1] = prefix[y] + rowEnergy[y]

		for (let top = 0; top <= lastTop; top += slidingStep) {
			const bottom = top + slidingWindowHeight
			const score = prefix[bottom] - prefix[top]
			if (score > bestScore) {
				bestScore = score
				bestTop = top
			}
		}

		// In case height < slidingStep, loop above still runs once at top = 0.
		const focus = (bestTop + slidingWindowHeight / 2) / height
		return Math.round(focus * 100)
	} catch (err) {
		console.error("Unexpected error while computing image focus:", err)
		return null
	}
}
