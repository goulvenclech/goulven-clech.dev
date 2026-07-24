import {
	BACKFILL_PERIOD,
	RATING_ORDER,
	SOURCE_ORDER,
	type Period,
} from "$src/catalogueStats"
import { ratingLabels, sourcePlurals } from "./reviewUtils"

/**
 * Colours live in the chart component's stylesheet, in two modes; a series
 * only names its custom property, so a restyle never touches this file.
 */
export interface SeriesDef {
	key: string
	label: string
	emoji: string
	colorVar: string
}

/** Hated → favorite. Ordered, polar, so charts split it around a neutral axis. */
export const RATING_SERIES: SeriesDef[] = RATING_ORDER.map((rating) => ({
	key: String(rating),
	label: ratingLabels[rating]?.verb ?? String(rating),
	emoji: ratingLabels[rating]?.emoji ?? "",
	colorVar: `--chart-rating-${rating}`,
}))

/** Media types. Nominal, so each gets its own hue rather than a ramp. */
export const SOURCE_SERIES: SeriesDef[] = SOURCE_ORDER.map((source, index) => ({
	key: source,
	label: sourcePlurals[source] ?? source,
	emoji: "",
	colorVar: `--chart-source-${index + 1}`,
}))

export function periodLabel(period: Period): string {
	return period === BACKFILL_PERIOD ? "before 2025" : period
}

export function sourceLabel(source: string): string {
	return sourcePlurals[source] ?? source
}
