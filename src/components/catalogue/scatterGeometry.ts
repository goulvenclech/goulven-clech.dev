import type { EmotionStat } from "$src/catalogue/stats"

/**
 * Layout maths for the emotion-impact bubble chart: frequency on x, average
 * rating on y, bubble area proportional to frequency. Kept out of the component
 * so the scales, the banding, and the label de-collision can be tested directly.
 */

/** Where an emotion's average rating falls relative to the rating scale. */
export type Band = "summit" | "ambivalent" | "chasm"

/**
 * The two thresholds mirror the rating scale itself: 3.5 is the neutral line
 * between unfavourable (1–3) and favourable (4–6), and 2.5 separates a leaning
 * towards « meh » (3) from an outright dislike (1–2).
 */
export const NEUTRAL_RATING = 3.5
export const DISLIKE_RATING = 2.5

export function classifyBand(avgRating: number): Band {
	if (avgRating >= NEUTRAL_RATING) return "summit"
	if (avgRating >= DISLIKE_RATING) return "ambivalent"
	return "chasm"
}

export interface Bubble extends EmotionStat {
	band: Band
	cx: number
	cy: number
	r: number
}

export interface Label {
	id: number
	text: string
	x: number
	y: number
	anchor: "start" | "end"
}

export interface ScatterLayout {
	bubbles: Bubble[]
	labels: Label[]
	xTicks: { value: number; x: number }[]
	yTicks: { value: number; y: number }[]
	/** Y coordinate of the dashed neutral line. */
	neutralY: number
	plot: { left: number; right: number; top: number; bottom: number }
}

export interface ScatterOptions {
	width: number
	height: number
	margin: { top: number; right: number; bottom: number; left: number }
	/**
	 * Rating-axis bounds. Kept tight to the ratings actually seen (1–5), and
	 * grown only if some emotion's average falls outside. Headroom for the bubble
	 * radii is solved in pixels by `solveAxisInsets`, never by padding the domain.
	 */
	yMin: number
	yMax: number
	minRadius: number
	maxRadius: number
	/** How many of the most frequent emotions get a direct label. */
	labelCount: number
}

/** Margins hold the tick numbers only; the caption names what the axes measure. */
export const DEFAULT_SCATTER_OPTIONS: ScatterOptions = {
	width: 760,
	height: 470,
	margin: { top: 4, right: 16, bottom: 28, left: 30 },
	yMin: 1,
	yMax: 5,
	minRadius: 4,
	maxRadius: 27,
	labelCount: 10,
}

/**
 * A squarer canvas for narrow screens. The SVG scales to the column width, so a
 * wide viewBox would shrink 11px text to about 5px; this keeps the same chart
 * legible by trading horizontal room for height, and labels fewer bubbles.
 */
export const MOBILE_SCATTER_OPTIONS: ScatterOptions = {
	width: 420,
	height: 420,
	margin: { top: 4, right: 12, bottom: 24, left: 24 },
	yMin: 1,
	yMax: 5,
	minRadius: 3,
	maxRadius: 15,
	labelCount: 5,
}

/** Round up to the next multiple of `step`, so the axis ends on a round tick. */
export function niceCeiling(value: number, step: number): number {
	if (value <= 0) return step
	return Math.ceil(value / step - 1e-9) * step
}

/**
 * Smallest 1/2/5 × 10ᵏ step that keeps the axis at or under `targetTicks`
 * intervals, floored at 1 because counts are whole. Derived from the data so
 * the axis stays readable as the busiest emotion grows from tens to hundreds.
 */
export function niceStep(maxValue: number, targetTicks = 5): number {
	if (maxValue <= targetTicks) return 1
	let magnitude = Math.max(
		1,
		Math.pow(10, Math.floor(Math.log10(maxValue / targetTicks))),
	)
	for (;;) {
		for (const multiple of [1, 2, 5]) {
			const step = multiple * magnitude
			if (maxValue / step <= targetTicks) return step
		}
		magnitude *= 10
	}
}

/**
 * Headroom, in pixels, that the rating axis must keep free at each end so no
 * bubble is clipped: a mark sits *on* its value, so a bubble near the top or
 * bottom of the scale overhangs by up to its own radius.
 *
 * Solved from the data instead of reserved as a constant, so the chart gives
 * away only the space its own extremes need. Each pass re-measures against the
 * height the previous insets left; the required inset only ever grows, bounded
 * by the largest radius, so a handful of passes settle it.
 */
export function solveAxisInsets(
	marks: { value: number; radius: number }[],
	yMin: number,
	yMax: number,
	plotHeight: number,
): { top: number; bottom: number } {
	const span = yMax - yMin
	let top = 0
	let bottom = 0
	if (span <= 0) return { top, bottom }

	for (let pass = 0; pass < 4; pass++) {
		const usable = plotHeight - top - bottom
		if (usable <= 0) break
		let nextTop = 0
		let nextBottom = 0
		for (const { value, radius } of marks) {
			nextTop = Math.max(nextTop, radius - ((yMax - value) / span) * usable)
			nextBottom = Math.max(
				nextBottom,
				radius - ((value - yMin) / span) * usable,
			)
		}
		top = Math.max(0, nextTop)
		bottom = Math.max(0, nextBottom)
	}
	return { top, bottom }
}

/**
 * Line height covers the 11px labels' ascenders and descenders. Character
 * width deliberately over-estimates, so a pair that might collide is always
 * tested rather than waved through.
 */
const APPROX_CHAR_WIDTH = 6.2
const LABEL_LINE_HEIGHT = 15
const LABEL_GAP = 5

/**
 * How far a tick number reaches above and below the gridline it sits on. The
 * end-of-axis ones need that room just as a bubble needs its radius, so they
 * join the inset solve as marks in their own right.
 */
const TICK_LABEL_REACH = 8

/**
 * Pick which emotions carry a direct label: the most frequent ones, plus the
 * highest and lowest average rating so both extremes of the story are named.
 * Everything else stays readable through the tooltip and the table.
 */
export function selectLabelled(
	stats: EmotionStat[],
	labelCount: number,
): Set<number> {
	if (stats.length === 0) return new Set()
	const byFrequency = [...stats].sort((a, b) => b.count - a.count)
	const chosen = new Set(byFrequency.slice(0, labelCount).map((s) => s.id))

	const byRating = [...stats].sort((a, b) => a.avgRating - b.avgRating)
	const lowest = byRating[0]
	const highest = byRating[byRating.length - 1]
	if (lowest) chosen.add(lowest.id)
	if (highest) chosen.add(highest.id)
	return chosen
}

/**
 * Push overlapping labels apart vertically. Labels are processed top-down and
 * only compared against neighbours whose horizontal spans actually overlap, so
 * a crowded corner spreads out while the rest of the chart stays put.
 */
export function resolveLabelCollisions(
	labels: Label[],
	bounds: { top: number; bottom: number },
): Label[] {
	const spanOf = (label: Label) => {
		const width = label.text.length * APPROX_CHAR_WIDTH
		return label.anchor === "start"
			? { from: label.x, to: label.x + width }
			: { from: label.x - width, to: label.x }
	}

	const placed: Label[] = []
	for (const label of [...labels].sort((a, b) => a.y - b.y)) {
		const span = spanOf(label)
		let y = label.y
		for (const other of placed) {
			const otherSpan = spanOf(other)
			const overlapsX = span.from < otherSpan.to && otherSpan.from < span.to
			if (overlapsX && Math.abs(y - other.y) < LABEL_LINE_HEIGHT) {
				y = other.y + LABEL_LINE_HEIGHT
			}
		}
		placed.push({
			...label,
			y: Math.min(Math.max(y, bounds.top), bounds.bottom),
		})
	}
	return placed
}

export function buildScatter(
	stats: EmotionStat[],
	options: ScatterOptions = DEFAULT_SCATTER_OPTIONS,
): ScatterLayout {
	const { width, height, margin, minRadius, maxRadius } = options
	const plot = {
		left: margin.left,
		right: width - margin.right,
		top: margin.top,
		bottom: height - margin.bottom,
	}

	// Widen past the configured bounds only when an average lands outside them.
	const ratings = stats.map((s) => s.avgRating)
	const yMin = Math.min(
		options.yMin,
		Math.floor(Math.min(...ratings, options.yMin)),
	)
	const yMax = Math.max(
		options.yMax,
		Math.ceil(Math.max(...ratings, options.yMax)),
	)

	const maxCount = stats.reduce((max, s) => Math.max(max, s.count), 0)
	const xStep = niceStep(maxCount)
	const xMax = niceCeiling(maxCount, xStep)

	// Area, not radius, carries frequency — otherwise big bubbles read far too big.
	const scaleR = (count: number) =>
		maxCount > 0
			? Math.max(minRadius, maxRadius * Math.sqrt(count / maxCount))
			: minRadius

	// Both axes are inset so a bubble centred on an extreme value isn't clipped.
	// The x inset is the worst case (the busiest emotion may sit on the last
	// tick); the y inset is solved from the ratings actually present.
	const yInset = solveAxisInsets(
		[
			...stats.map((stat) => ({
				value: stat.avgRating,
				radius: scaleR(stat.count),
			})),
			// The first and last tick numbers straddle their own gridline.
			{ value: yMax, radius: TICK_LABEL_REACH },
			{ value: yMin, radius: TICK_LABEL_REACH },
		],
		yMin,
		yMax,
		plot.bottom - plot.top,
	)
	const xStart = plot.left + minRadius
	const xEnd = plot.right - maxRadius
	const yTop = plot.top + yInset.top
	const yBottom = plot.bottom - yInset.bottom
	const scaleX = (count: number) => xStart + (count / xMax) * (xEnd - xStart)
	const scaleY = (rating: number) =>
		yBottom - ((rating - yMin) / (yMax - yMin)) * (yBottom - yTop)

	const bubbles: Bubble[] = stats.map((stat) => ({
		...stat,
		band: classifyBand(stat.avgRating),
		cx: scaleX(stat.count),
		cy: scaleY(stat.avgRating),
		r: scaleR(stat.count),
	}))

	const labelled = selectLabelled(stats, options.labelCount)
	const rawLabels: Label[] = bubbles
		.filter((bubble) => labelled.has(bubble.id))
		.map((bubble) => {
			const width = bubble.name.length * APPROX_CHAR_WIDTH
			const toRight = bubble.cx + bubble.r + LABEL_GAP
			const fits = toRight + width <= plot.right
			return {
				id: bubble.id,
				text: bubble.name,
				x: fits ? toRight : bubble.cx - bubble.r - LABEL_GAP,
				y: bubble.cy + 4,
				anchor: fits ? ("start" as const) : ("end" as const),
			}
		})

	const xTicks = []
	for (let value = 0; value <= xMax; value += xStep) {
		xTicks.push({ value, x: scaleX(value) })
	}
	const yTicks = []
	for (let value = Math.max(1, yMin); value <= yMax; value += 1) {
		yTicks.push({ value, y: scaleY(value) })
	}

	return {
		bubbles,
		labels: resolveLabelCollisions(rawLabels, {
			top: plot.top + 8,
			bottom: plot.bottom - 2,
		}),
		xTicks,
		yTicks,
		neutralY: scaleY(NEUTRAL_RATING),
		plot,
	}
}

/** "amused: 93 reviews, 4.19 average" — tooltip and native-title text. */
export function bubbleTitle(bubble: Bubble): string {
	const reviews = bubble.count === 1 ? "review" : "reviews"
	return `${bubble.name}: ${bubble.count} ${reviews}, ${bubble.avgRating.toFixed(2)} average`
}
