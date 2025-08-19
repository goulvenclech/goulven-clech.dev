import sharp from "sharp"
import { readFile } from "node:fs/promises"

async function computeFocus(buffer: Buffer): Promise<number | null> {
	try {
		const base = sharp(buffer).resize({ width: 256, withoutEnlargement: true })
		const { info } = await base.clone().toBuffer({ resolveWithObject: true })
		const { width, height } = info
		if (!width || !height) {
			console.error("Failed to retrieve image metadata")
			return null
		}

		const slidingWindowHeight = Math.min(50, height)
		const slidingStep = 5

		let bestTop = 0
		let bestEntropy = -Infinity
		const lastTop = Math.max(0, height - slidingWindowHeight)

		for (let top = 0; top <= lastTop; top += slidingStep) {
			const partBuffer = await base
				.clone()
				.extract({ left: 0, top, width, height: slidingWindowHeight })
				.toBuffer()

			const stats = await sharp(partBuffer).greyscale().stats()
			if (stats.entropy > bestEntropy) {
				bestEntropy = stats.entropy
				bestTop = top
			}
		}

		const focus = (bestTop + slidingWindowHeight / 2) / height
		return Math.round(focus * 100)
	} catch (err) {
		console.error("Unexpected error while computing image focus:", err)
		return null
	}
}

export async function computeImageFocusYFromBuffer(buffer: Buffer): Promise<number | null> {
	return computeFocus(buffer)
}

export async function computeImageFocusYFromFile(path: string): Promise<number | null> {
	const buffer = await readFile(path)
	return computeFocus(buffer)
}

export async function computeImageFocusYFromUrl(url: string): Promise<number | null> {
	try {
		const res = await fetch(url)
		if (!res.ok) {
			console.error("Failed to fetch image:", res.statusText)
			return null
		}
		const buffer = Buffer.from(await res.arrayBuffer())
		return computeFocus(buffer)
	} catch (err) {
		console.error("Unexpected error while fetching image:", err)
		return null
	}
}
