export const SPARKLINE_WIDTH = 288
export const SPARKLINE_HEIGHT = 64
const PAD = 6

export interface Sparkline {
	/** SVG path data; gaps (nulls) break the line so a missed week stays visible. */
	path: string
	last: { x: number; y: number } | null
}

/** Floor and ceiling the scale always spans; values outside push them out. */
export interface SparklineBounds {
	min: number
	max: number
}

export function sparkline(
	values: readonly (number | null)[],
	bounds?: SparklineBounds,
): Sparkline {
	const present = values.flatMap((value) => (value === null ? [] : [value]))
	const scale = bounds ? [...present, bounds.min, bounds.max] : present
	const max = Math.max(...scale)
	const min = Math.min(...scale)

	const x = (index: number) =>
		values.length === 1
			? SPARKLINE_WIDTH / 2
			: PAD + (index * (SPARKLINE_WIDTH - 2 * PAD)) / (values.length - 1)
	const y = (value: number) =>
		max === min
			? SPARKLINE_HEIGHT / 2
			: SPARKLINE_HEIGHT -
				PAD -
				((value - min) * (SPARKLINE_HEIGHT - 2 * PAD)) / (max - min)

	let path = ""
	let pen = false
	let last: { x: number; y: number } | null = null
	for (const [index, value] of values.entries()) {
		if (value === null) {
			pen = false
			continue
		}
		const cx = x(index)
		const cy = y(value)
		path += `${pen ? "L" : "M"}${cx.toFixed(1)} ${cy.toFixed(1)} `
		pen = true
		last = { x: cx, y: cy }
	}
	return { path: path.trim(), last }
}
