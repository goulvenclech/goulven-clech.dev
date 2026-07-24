import { describe, it, expect } from "vitest"
import type { EmotionStat } from "../src/catalogueStats"
import {
	buildScatter,
	bubbleTitle,
	classifyBand,
	DEFAULT_SCATTER_OPTIONS,
	MOBILE_SCATTER_OPTIONS,
	niceCeiling,
	niceStep,
	resolveLabelCollisions,
	selectLabelled,
	solveAxisInsets,
	type Label,
} from "../src/components/catalogue/scatterGeometry"

const stat = (
	id: number,
	name: string,
	count: number,
	avgRating: number,
): EmotionStat => ({ id, emoji: "🙂", name, count, avgRating })

describe("classifyBand", () => {
	it("puts anything at or above the neutral line in the summit band", () => {
		expect(classifyBand(3.5)).toBe("summit")
		expect(classifyBand(4.9)).toBe("summit")
	})

	it("treats the band between the dislike and neutral marks as ambivalent", () => {
		expect(classifyBand(2.5)).toBe("ambivalent")
		expect(classifyBand(2.99)).toBe("ambivalent")
		expect(classifyBand(3.49)).toBe("ambivalent")
	})

	it("puts anything below the dislike mark in the chasm", () => {
		expect(classifyBand(2.49)).toBe("chasm")
		expect(classifyBand(1)).toBe("chasm")
	})
})

describe("niceCeiling", () => {
	it("rounds up to the next multiple of the step", () => {
		expect(niceCeiling(93, 20)).toBe(100)
		expect(niceCeiling(41, 20)).toBe(60)
	})

	it("leaves an exact multiple alone", () => {
		expect(niceCeiling(80, 20)).toBe(80)
	})

	it("never returns zero, so the scale can't divide by nothing", () => {
		expect(niceCeiling(0, 20)).toBe(20)
	})
})

describe("niceStep", () => {
	it("keeps a step of 20 for a top count in the nineties", () => {
		expect(niceStep(93)).toBe(20)
	})

	it("climbs the 1/2/5 ladder as the top count grows", () => {
		expect(niceStep(300)).toBe(100)
		expect(niceStep(500)).toBe(100)
		expect(niceStep(2400)).toBe(500)
	})

	it("floors at 1 for tiny counts, since counts are whole", () => {
		expect(niceStep(3)).toBe(1)
		expect(niceStep(0)).toBe(1)
	})
})

describe("solveAxisInsets", () => {
	it("reserves a full radius when a mark sits exactly on an axis end", () => {
		const { top, bottom } = solveAxisInsets(
			[
				{ value: 5, radius: 27 },
				{ value: 1, radius: 12 },
			],
			1,
			5,
			400,
		)
		expect(top).toBeCloseTo(27, 5)
		expect(bottom).toBeCloseTo(12, 5)
	})

	it("reserves nothing when every mark sits clear of both ends", () => {
		const insets = solveAxisInsets([{ value: 3, radius: 20 }], 1, 5, 400)
		expect(insets.top).toBe(0)
		expect(insets.bottom).toBe(0)
	})

	it("charges only what a near-the-edge mark overhangs, not its whole radius", () => {
		// 4.9 of a 1–5 scale sits 2.5% down the axis, so most of the radius is
		// already covered by the plot itself.
		const { top } = solveAxisInsets([{ value: 4.9, radius: 20 }], 1, 5, 400)
		expect(top).toBeGreaterThan(0)
		expect(top).toBeLessThan(20)
	})

	it("keeps every mark inside the plot once its insets are applied", () => {
		const marks = [
			{ value: 5, radius: 27 },
			{ value: 4.9, radius: 16 },
			{ value: 2.6, radius: 24 },
			{ value: 1, radius: 7 },
		]
		const plotHeight = 430
		const { top, bottom } = solveAxisInsets(marks, 1, 5, plotHeight)
		const usable = plotHeight - top - bottom
		for (const { value, radius } of marks) {
			const y = top + ((5 - value) / 4) * usable
			expect(y - radius).toBeGreaterThanOrEqual(-1e-6)
			expect(y + radius).toBeLessThanOrEqual(plotHeight + 1e-6)
		}
	})

	it("handles a degenerate scale without dividing by zero", () => {
		expect(solveAxisInsets([{ value: 3, radius: 10 }], 3, 3, 400)).toEqual({
			top: 0,
			bottom: 0,
		})
	})
})

describe("selectLabelled", () => {
	const stats = [
		stat(1, "amused", 93, 4.19),
		stat(2, "frustrated", 83, 2.99),
		stat(3, "bored", 69, 2.41),
		stat(4, "moved", 31, 4.9),
		stat(5, "angered", 6, 1.0),
	]

	it("labels the most frequent emotions", () => {
		const chosen = selectLabelled(stats, 2)
		expect(chosen.has(1)).toBe(true) // amused, most frequent
		expect(chosen.has(2)).toBe(true) // frustrated, second
	})

	it("always labels both rating extremes, however rare they are", () => {
		const chosen = selectLabelled(stats, 2)
		expect(chosen.has(4)).toBe(true) // highest average, only 31 tags
		expect(chosen.has(5)).toBe(true) // lowest average, only 6 tags
	})

	it("leaves the unremarkable middle unlabelled", () => {
		expect(selectLabelled(stats, 2).has(3)).toBe(false) // bored
	})

	it("handles an empty set", () => {
		expect(selectLabelled([], 10).size).toBe(0)
	})
})

describe("resolveLabelCollisions", () => {
	const bounds = { top: 0, bottom: 500 }

	it("pushes apart labels that overlap in both axes", () => {
		const labels: Label[] = [
			{ id: 1, text: "amused", x: 100, y: 200, anchor: "start" },
			{ id: 2, text: "captivated", x: 100, y: 203, anchor: "start" },
		]
		const placed = resolveLabelCollisions(labels, bounds)
		const ys = placed.map((l) => l.y).sort((a, b) => a - b)
		expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(13)
	})

	it("leaves labels alone when their horizontal spans don't overlap", () => {
		const labels: Label[] = [
			{ id: 1, text: "amused", x: 0, y: 200, anchor: "start" },
			{ id: 2, text: "bored", x: 400, y: 202, anchor: "start" },
		]
		const placed = resolveLabelCollisions(labels, bounds)
		expect(placed.map((l) => l.y)).toEqual([200, 202])
	})

	it("keeps every label inside the plot bounds", () => {
		const labels: Label[] = [
			{ id: 1, text: "aaa", x: 10, y: 495, anchor: "start" },
			{ id: 2, text: "bbb", x: 10, y: 496, anchor: "start" },
			{ id: 3, text: "ccc", x: 10, y: 497, anchor: "start" },
		]
		const placed = resolveLabelCollisions(labels, bounds)
		expect(placed.every((l) => l.y <= 500 && l.y >= 0)).toBe(true)
	})
})

describe("buildScatter", () => {
	const stats = [
		stat(1, "amused", 100, 4.2),
		stat(2, "frustrated", 50, 3.0),
		stat(3, "angered", 1, 1.0),
	]

	it("maps frequency onto x, left to right", () => {
		const { bubbles } = buildScatter(stats)
		const amused = bubbles.find((b) => b.name === "amused")!
		const angered = bubbles.find((b) => b.name === "angered")!
		expect(amused.cx).toBeGreaterThan(angered.cx)
	})

	it("maps a higher rating to a smaller y, since SVG counts downwards", () => {
		const { bubbles } = buildScatter(stats)
		const amused = bubbles.find((b) => b.name === "amused")!
		const angered = bubbles.find((b) => b.name === "angered")!
		expect(amused.cy).toBeLessThan(angered.cy)
	})

	it("scales bubble area, not radius, with frequency", () => {
		const { bubbles } = buildScatter([
			stat(1, "a", 100, 4),
			stat(2, "b", 25, 4),
		])
		const [big, small] = bubbles
		// Quarter the count is half the radius, so area stays proportional.
		expect(small.r / big.r).toBeCloseTo(0.5, 5)
	})

	it("floors tiny bubbles so a single-use emotion stays visible", () => {
		const { bubbles } = buildScatter(stats)
		const angered = bubbles.find((b) => b.name === "angered")!
		expect(angered.r).toBe(DEFAULT_SCATTER_OPTIONS.minRadius)
	})

	it("keeps every bubble inside the viewBox", () => {
		const { width, height } = DEFAULT_SCATTER_OPTIONS
		const { bubbles } = buildScatter(stats)
		for (const bubble of bubbles) {
			expect(bubble.cx - bubble.r).toBeGreaterThanOrEqual(-1)
			expect(bubble.cx + bubble.r).toBeLessThanOrEqual(width + 1)
			expect(bubble.cy - bubble.r).toBeGreaterThanOrEqual(-1)
			expect(bubble.cy + bubble.r).toBeLessThanOrEqual(height + 1)
		}
	})

	it("keeps a big bubble at a rating extreme from clipping the frame", () => {
		const { width, height } = DEFAULT_SCATTER_OPTIONS
		// A frequent emotion (largest radius) averaging a perfect 5 and a rock
		// bottom 1 — the pixel inset, not domain padding, has to hold them in.
		const { bubbles } = buildScatter([
			stat(1, "loved-by-all", 100, 5),
			stat(2, "hated-by-all", 100, 1),
		])
		for (const bubble of bubbles) {
			expect(bubble.cy - bubble.r).toBeGreaterThanOrEqual(-1)
			expect(bubble.cy + bubble.r).toBeLessThanOrEqual(height + 1)
			expect(bubble.cx + bubble.r).toBeLessThanOrEqual(width + 1)
		}
	})

	it("puts the neutral line between the ambivalent and summit bands", () => {
		const { bubbles, neutralY } = buildScatter(stats)
		const summit = bubbles.find((b) => b.band === "summit")!
		const ambivalent = bubbles.find((b) => b.band === "ambivalent")!
		expect(summit.cy).toBeLessThan(neutralY)
		expect(ambivalent.cy).toBeGreaterThan(neutralY)
	})

	it("classifies each bubble into a band", () => {
		const { bubbles } = buildScatter(stats)
		expect(bubbles.map((b) => b.band)).toEqual([
			"summit",
			"ambivalent",
			"chasm",
		])
	})

	it("keeps labels within the plot's right edge by flipping them", () => {
		const { labels, plot } = buildScatter(stats)
		for (const label of labels) {
			expect(label.x).toBeLessThanOrEqual(plot.right)
			expect(label.x).toBeGreaterThanOrEqual(plot.left - 60)
		}
	})

	it("leaves the end tick numbers room above and below their gridline", () => {
		const { height } = DEFAULT_SCATTER_OPTIONS
		// Nothing sits near the ends here, so only the tick labels demand headroom.
		const { yTicks } = buildScatter([stat(1, "middling", 40, 3)])
		const top = yTicks[yTicks.length - 1]
		const bottom = yTicks[0]
		expect(top.y).toBeGreaterThanOrEqual(8)
		expect(bottom.y).toBeLessThanOrEqual(height - 8)
	})

	it("returns an empty layout for no data", () => {
		const layout = buildScatter([])
		expect(layout.bubbles).toEqual([])
		expect(layout.labels).toEqual([])
	})

	it("keeps a readable number of ticks when the top count reaches 500", () => {
		const { xTicks } = buildScatter(
			[stat(1, "amused", 500, 4.2)],
			MOBILE_SCATTER_OPTIONS,
		)
		expect(xTicks.length).toBeLessThanOrEqual(8)
	})

	it("keeps adjacent mobile tick labels from overlapping at count 500", () => {
		const { xTicks } = buildScatter(
			[stat(1, "amused", 500, 4.2)],
			MOBILE_SCATTER_OPTIONS,
		)
		// Mirrors the geometry's own label-width estimate.
		const approxCharWidth = 6.2
		for (let i = 1; i < xTicks.length; i++) {
			const gap = xTicks[i].x - xTicks[i - 1].x
			const labelWidth = String(xTicks[i].value).length * approxCharWidth
			expect(gap).toBeGreaterThanOrEqual(labelWidth + 2)
		}
	})
})

describe("bubbleTitle", () => {
	it("reads as emotion, count, and average", () => {
		const [bubble] = buildScatter([stat(1, "amused", 93, 4.194)]).bubbles
		expect(bubbleTitle(bubble)).toBe("amused: 93 reviews, 4.19 average")
	})

	it("uses the singular for a one-off emotion", () => {
		const [bubble] = buildScatter([stat(1, "ironic", 1, 4)]).bubbles
		expect(bubbleTitle(bubble)).toBe("ironic: 1 review, 4.00 average")
	})
})
