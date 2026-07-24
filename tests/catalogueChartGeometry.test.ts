import { describe, it, expect } from "vitest"
import type { CrossTabRow } from "../src/catalogueStats"
import {
	barLayout,
	formatShare,
	isLabelled,
	type Segment,
} from "../src/components/catalogue/chartGeometry"

/** Build a row from raw counts, deriving each cell's share like `crossTab` does. */
function row(key: string, counts: Record<string, number>): CrossTabRow {
	const entries = Object.entries(counts)
	const total = entries.reduce((sum, [, n]) => sum + n, 0)
	return {
		key,
		total,
		cells: entries.map(([k, count]) => ({
			key: k,
			count,
			share: total > 0 ? count / total : 0,
		})),
	}
}

describe("barLayout — plain stack (splitAfter 0)", () => {
	it("puts every cell in the positive arm and none in the negative", () => {
		const layout = barLayout([row("2025", { a: 1, b: 3 })], 0)
		expect(layout.diverging).toBe(false)
		expect(layout.rows[0].negative).toHaveLength(0)
		expect(layout.rows[0].positive.map((s) => s.key)).toEqual(["a", "b"])
	})

	it("fills the width exactly, so a full row's segments sum to 100%", () => {
		const layout = barLayout([row("2025", { a: 1, b: 1, c: 2 })], 0)
		const total = layout.rows[0].positive.reduce(
			(sum, s) => sum + s.widthPercent,
			0,
		)
		expect(total).toBeCloseTo(100, 5)
	})
})

describe("barLayout — diverging (splitAfter 3)", () => {
	const rows: CrossTabRow[] = [
		row("bad-year", { "1": 4, "2": 4, "3": 2, "4": 0, "5": 0, "6": 0 }),
		row("good-year", { "1": 0, "2": 1, "3": 1, "4": 4, "5": 3, "6": 1 }),
	]

	it("splits cells into the two arms at the boundary", () => {
		const layout = barLayout(rows, 3)
		expect(layout.diverging).toBe(true)
		expect(layout.rows[0].negative.map((s) => s.key)).toEqual(["1", "2", "3"])
		expect(layout.rows[0].positive.map((s) => s.key)).toEqual(["4", "5", "6"])
	})

	it("keeps arms in natural series order (the component right-aligns them)", () => {
		const layout = barLayout(rows, 3)
		// Not reversed: hate → dislike → meh, left to right.
		expect(layout.rows[0].negative.map((s) => s.key)).toEqual(["1", "2", "3"])
	})

	it("scales both arms to a shared round tick, never overflowing 100%", () => {
		const layout = barLayout(rows, 3)
		// bad-year is 100% negative, so the arm scale rounds up to a full arm.
		expect(layout.armScale).toBeCloseTo(1, 5)
		for (const r of layout.rows) {
			const arm = (segs: Segment[]) =>
				segs.reduce((sum, s) => sum + s.widthPercent, 0)
			expect(arm(r.negative)).toBeLessThanOrEqual(100 + 1e-6)
			expect(arm(r.positive)).toBeLessThanOrEqual(100 + 1e-6)
		}
	})

	it("scales the shorter arm against the longer one, filling it to 100%", () => {
		// 40% negative, 60% positive → arm scale rounds to the 60% arm.
		const layout = barLayout(
			[row("y", { "1": 0, "2": 2, "3": 2, "4": 3, "5": 3, "6": 0 })],
			3,
		)
		expect(layout.armScale).toBeCloseTo(0.6, 5)
		const width = (segs: Segment[]) =>
			segs.reduce((sum, s) => sum + s.widthPercent, 0)
		// The longer (positive) arm fills the plot; the shorter one is proportional.
		expect(width(layout.rows[0].positive)).toBeCloseTo(100, 5)
		expect(width(layout.rows[0].negative)).toBeCloseTo((0.4 / 0.6) * 100, 5)
	})
})

describe("barLayout — empty rows", () => {
	it("keeps a zero-total row with empty arms", () => {
		const layout = barLayout([row("silent", {})], 3)
		expect(layout.rows[0].total).toBe(0)
		expect(layout.rows[0].positive.every((s) => s.widthPercent === 0)).toBe(
			true,
		)
	})
})

describe("formatShare", () => {
	it("rounds to a whole percentage", () => {
		expect(formatShare(0.184)).toBe("18%")
		expect(formatShare(0.005)).toBe("1%")
		expect(formatShare(1)).toBe("100%")
	})
})

describe("isLabelled", () => {
	const seg = (widthPercent: number): Segment => ({
		key: "x",
		count: 1,
		share: 0.5,
		widthPercent,
	})

	it("labels segments at least 9% of an arm wide", () => {
		expect(isLabelled(seg(9))).toBe(true)
		expect(isLabelled(seg(40))).toBe(true)
	})

	it("drops labels on slivers too narrow for the text", () => {
		expect(isLabelled(seg(8.9))).toBe(false)
		expect(isLabelled(seg(0))).toBe(false)
	})
})
