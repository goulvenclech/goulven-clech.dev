const DAYS_OF_WEEK = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
] as const

/**
 * Converts a day index to its name (Google Places API convention: 0 = Sunday).
 */
export function dayOfWeekAsString(dayIndex: number): string {
	return DAYS_OF_WEEK[dayIndex] ?? ""
}

/**
 * Takes the Places API `regularOpeningHours.periods` array and returns a
 * human-readable sentence listing the closed days.
 */
export function getClosedDays(periods: unknown): string {
	if (!Array.isArray(periods)) return "Unknown opening days."

	const openedDays = (periods as Array<Record<string, unknown>>)
		.map((p) => (p.open as Record<string, unknown> | undefined)?.day)
		.filter((d): d is number => typeof d === "number")

	const closedDays = [0, 1, 2, 3, 4, 5, 6]
		.filter((d) => !openedDays.includes(d))
		.map(dayOfWeekAsString)
		.join(", ")

	return closedDays === "" ? "Open every day." : `Closed on ${closedDays}.`
}

/**
 * Scales dimensions so that `height` does not exceed `maxHeight`, preserving
 * aspect ratio. Returns original dimensions when already within bounds.
 */
export function scaleToMaxHeight(
	originalWidth: number,
	originalHeight: number,
	maxHeight: number,
): { width: number; height: number } {
	if (originalHeight > maxHeight) {
		return {
			width: Math.max(
				1,
				Math.round(originalWidth * (maxHeight / originalHeight)),
			),
			height: maxHeight,
		}
	}
	return { width: originalWidth, height: originalHeight }
}
