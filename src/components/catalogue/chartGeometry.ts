import type { Cell, CrossTabRow } from "$src/catalogueStats"

/**
 * Layout maths for the catalogue's stacked bars, shared by the rating and media
 * charts. Kept out of the components so it can be tested directly.
 *
 * A row is split into a negative and a positive arm at `splitAfter` cells. The
 * rating chart splits after the three unfavourable ratings so the bar diverges
 * around a neutral axis; the media chart passes `splitAfter = 0`, leaving one
 * full-width positive arm — an ordinary left-anchored 100% stack.
 */

export interface Segment extends Cell {
	/** Width as a percentage of a full arm, already scaled. */
	widthPercent: number
}

export interface BarRow {
	key: string
	total: number
	/** Cells left of the axis, kept in series order (component right-aligns). */
	negative: Segment[]
	/** Cells right of the axis, in series order. */
	positive: Segment[]
}

export interface BarLayout {
	/** True once any row has a negative arm — the axis then sits centred. */
	diverging: boolean
	/** Share that fills a whole arm; shared by both arms so rows stay comparable. */
	armScale: number
	rows: BarRow[]
}

/** Round a share up to the next tenth so arms end on a clean 10% boundary. */
function niceArmScale(longestArm: number): number {
	return Math.max(0.1, Math.ceil(longestArm * 10 - 1e-9) / 10)
}

const sumShares = (cells: Cell[]): number =>
	cells.reduce((sum, cell) => sum + cell.share, 0)

export function barLayout(rows: CrossTabRow[], splitAfter: number): BarLayout {
	const split = rows.map((row) => ({
		key: row.key,
		total: row.total,
		negativeCells: row.cells.slice(0, splitAfter),
		positiveCells: row.cells.slice(splitAfter),
	}))

	const longestArm = split.reduce(
		(longest, { negativeCells, positiveCells }) =>
			Math.max(longest, sumShares(negativeCells), sumShares(positiveCells)),
		0,
	)
	const armScale = niceArmScale(longestArm)

	const scale = (cells: Cell[]): Segment[] =>
		cells.map((cell) => ({
			...cell,
			widthPercent: (cell.share / armScale) * 100,
		}))

	return {
		diverging: split.some(({ negativeCells }) => negativeCells.length > 0),
		armScale,
		rows: split.map(({ key, total, negativeCells, positiveCells }) => ({
			key,
			total,
			negative: scale(negativeCells),
			positive: scale(positiveCells),
		})),
	}
}

/** Rounded percentage, e.g. `0.184` → `"18%"`. */
export function formatShare(share: number): string {
	return `${Math.round(share * 100)}%`
}

/**
 * Segments narrower than this percentage of an arm carry no inline label — the
 * text would not fit. The tooltip and the table view still hold the number.
 */
const MIN_LABELLED_WIDTH = 9

export function isLabelled(segment: Segment): boolean {
	return segment.widthPercent >= MIN_LABELLED_WIDTH
}
