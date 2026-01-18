export interface GaugeProps {
	radius: number
	value: number
	max: number
	strokeClass: string
	dimThreshold?: number
}

/**
 * Returns the (x, y) coordinates on the gauge circle for a given angle offset (in degrees).
 */
function getCirclePositionOnGauge(
	baseAngleDeg: number,
	offsetDeg: number,
	radius: number,
) {
	const angleRad = ((baseAngleDeg + offsetDeg) * Math.PI) / 180
	return {
		x: 60 + radius * Math.cos(angleRad),
		y: 60 + radius * Math.sin(angleRad),
	}
}

/**
 * Reusable SVG circular gauge.
 * • Draws a first arc from 0 to `max` (100 %).
 * • Supports values above `max` by adding an overlay arc that starts where the
 *   first ends; When a lap completes, a background dot marks its end so we can
 *   count how many additional 100 % have been reached. Dots are slightly offset
 *   to remain readable when stacked.
 * • Dims the stroke if the value is below a threshold (default is `max`).
 */
export function renderHealthGauge({
	radius,
	value,
	max,
	strokeClass,
	dimThreshold = max,
}: GaugeProps): string {
	const firstValue = Math.min(value, max)
	const extraValue = Math.max(value - max, 0)
	const isDim = value < dimThreshold
	const CIRCUMFERENCE = 2 * Math.PI * radius

	// Used by the first lap
	const originalratio = firstValue / max
	const originalArcOffset = (CIRCUMFERENCE * (1 - originalratio)).toFixed(1)

	// Extra laps logic
	const extraLaps = Math.floor(value / max)
	const lapRatio = (value % max) / max
	let extraSegmentsArr = []
	for (let i = 0; i < extraLaps; i++) {
		const offsetDeg = i * 5.5
		const arcStartDeg = -90 + offsetDeg
		const arcOffset = (CIRCUMFERENCE * (1 - lapRatio)).toFixed(1)
		const dotAngle = -90 + 360 * lapRatio + offsetDeg
		const dot = getCirclePositionOnGauge(dotAngle, 0, radius)
		extraSegmentsArr.push(`
      <g>
        <circle cx="${dot.x.toFixed(2)}" cy="${dot.y.toFixed(2)}" r="7" class="fill-body-light dark:fill-body-dark"></circle>
        <circle cx="${dot.x.toFixed(2)}" cy="${dot.y.toFixed(2)}" r="4" class="${strokeClass} stroke-2"></circle>
      </g>
      <circle
        cx="60" cy="60" r="${radius}"
        class="fill-none ${strokeClass}${isDim ? " opacity-50" : ""}"
        stroke-width="10"
        stroke-dasharray="${CIRCUMFERENCE}"
        stroke-dashoffset="${arcOffset}"
        transform="rotate(${arcStartDeg} 60 60)"
        stroke-linecap="round"></circle>
    `)
	}
	// Reverse the segments so the shortest segment is on top
	const extraSegmentsSvg = extraSegmentsArr.reverse().join("")

	return `
    <circle
      cx="60" cy="60" r="${radius}"
      class="fill-none ${strokeClass}${isDim ? " opacity-50" : ""}"
      stroke-width="10"
      stroke-dasharray="${CIRCUMFERENCE}"
      stroke-dashoffset="${originalArcOffset}"
      transform="rotate(-90 60 60)"
      stroke-linecap="round"></circle>
    ${
			extraValue > 0
				? `
      ${extraSegmentsSvg}
    `
				: ""
		}
  `
}
