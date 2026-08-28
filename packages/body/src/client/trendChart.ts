import {
	SPARKLINE_HEIGHT,
	SPARKLINE_WIDTH,
	sparkline,
	type SparklineBounds,
} from "../sparkline"

const SVG_NS = "http://www.w3.org/2000/svg"

export function trendChart(
	values: readonly (number | null)[],
	label: string,
	bounds?: SparklineBounds,
): SVGSVGElement {
	const { path, last } = sparkline(values, bounds)

	const svg = document.createElementNS(SVG_NS, "svg")
	svg.setAttribute("viewBox", `0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`)
	svg.setAttribute("class", "w-full")
	svg.setAttribute("role", "img")
	svg.setAttribute("aria-label", label)

	const line = document.createElementNS(SVG_NS, "path")
	line.setAttribute("d", path)
	line.setAttribute("fill", "none")
	line.setAttribute("stroke", "currentColor")
	line.setAttribute("stroke-width", "2.5")
	line.setAttribute("stroke-linecap", "round")
	line.setAttribute("stroke-linejoin", "round")
	svg.append(line)

	if (last) {
		const dot = document.createElementNS(SVG_NS, "circle")
		dot.setAttribute("cx", String(last.x))
		dot.setAttribute("cy", String(last.y))
		dot.setAttribute("r", "3.5")
		dot.setAttribute("class", "fill-primary")
		svg.append(dot)
	}
	return svg
}
