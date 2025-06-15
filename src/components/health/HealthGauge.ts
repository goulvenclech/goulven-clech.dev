export interface GaugeProps {
  radius: number
  value: number
  max: number
  strokeClass: string
  dimThreshold?: number
}

/**
 * Reusable SVG circular gauge.
 * • Draws a first arc from 0 to `max` (100 %).
 * • Supports values above `max` by adding an overlay arc that starts where the
 *   first ends; a small background dot is placed at the end of this second arc
 *   to visually separate both strokes.
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
  const firstRatio = firstValue / max
  const extraRatio = Math.min(extraValue / max, 1)

  const CIRCUMFERENCE = 2 * Math.PI * radius
  const offset1 = (CIRCUMFERENCE * (1 - firstRatio)).toFixed(1)
  const offset2 = (CIRCUMFERENCE * (1 - extraRatio)).toFixed(1)

  const startExtraDeg = -90 + 360 * firstRatio
  const endExtraDeg = -90 + 360 * (firstRatio + extraRatio)
  const radDot = (endExtraDeg * Math.PI) / 180
  const dotX = 60 + radius * Math.cos(radDot)
  const dotY = 60 + radius * Math.sin(radDot)

  const isDim = value < dimThreshold

  return `
    <circle
      cx="60" cy="60" r="${radius}"
      class="fill-none ${strokeClass}${isDim ? " opacity-50" : ""}"
      stroke-width="10"
      stroke-dasharray="${CIRCUMFERENCE}"
      stroke-dashoffset="${offset1}"
      transform="rotate(-90 60 60)"
      stroke-linecap="round"></circle>
    ${extraValue > 0 ? `
      <circle cx="${dotX.toFixed(2)}" cy="${dotY.toFixed(2)}" r="7" class="fill-body-light dark:fill-body-dark"></circle>
      <circle
        cx="60" cy="60" r="${radius}"
        class="fill-none ${strokeClass}${isDim ? " opacity-50" : ""}"
        stroke-width="10"
        stroke-dasharray="${CIRCUMFERENCE}"
        stroke-dashoffset="${offset2}"
        transform="rotate(${startExtraDeg} 60 60)"
        stroke-linecap="round"></circle>
    ` : ""}
  `
}
