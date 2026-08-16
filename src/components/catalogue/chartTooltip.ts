/**
 * Progressive-enhancement tooltip for the catalogue charts. Segments ship with a
 * native `title`, so hover works with no JavaScript; when this runs it swaps that
 * for a styled floating box tracking the pointer or keyboard focus. One delegated
 * listener covers every chart on the page.
 */
const SEGMENT_SELECTOR = "[data-tooltip]"

let tooltip: HTMLElement | null = null

function ensureTooltip(): HTMLElement {
	if (tooltip) return tooltip
	tooltip = document.createElement("div")
	tooltip.className = "chart-tooltip"
	tooltip.setAttribute("role", "status")
	tooltip.hidden = true
	document.body.append(tooltip)
	return tooltip
}

function place(
	box: HTMLElement,
	at: { clientX: number; clientY: number },
): void {
	const margin = 12
	const { innerWidth } = window
	const { offsetWidth, offsetHeight } = box
	// Prefer above-right of the cursor, flipping near the viewport edges.
	let x = at.clientX + margin
	let y = at.clientY - offsetHeight - margin
	if (x + offsetWidth > innerWidth - margin)
		x = at.clientX - offsetWidth - margin
	if (y < margin) y = at.clientY + margin
	box.style.transform = `translate(${Math.max(margin, x)}px, ${Math.max(margin, y)}px)`
}

/** Bars are HTML elements, bubbles are SVG ones; both carry `dataset`. */
type Markable = HTMLElement | SVGElement

function segmentAt(target: EventTarget | null): Markable | null {
	return target instanceof Element
		? (target.closest(SEGMENT_SELECTOR) as Markable | null)
		: null
}

/** Attach the shared tooltip once. Safe to call from every chart's script. */
export function initChartTooltips(): void {
	if (typeof document === "undefined") return
	if (document.body.dataset.chartTooltips === "ready") return
	document.body.dataset.chartTooltips = "ready"

	// Marks carry the same text natively (a `title` attribute on bars, a `<title>`
	// child on SVG bubbles) and in `data-tooltip`, which the box reads. Drop the
	// native ones so browser and custom tooltips don't stack on hover.
	for (const mark of document.querySelectorAll(SEGMENT_SELECTOR)) {
		mark.removeAttribute("title")
		mark.querySelector(":scope > title")?.remove()
	}

	document.addEventListener("pointermove", (event) => {
		const segment = segmentAt(event.target)
		if (!segment) {
			if (tooltip) tooltip.hidden = true
			return
		}
		show(segment, event)
	})

	// Thumbnail links can hold focus; chart marks can't, so this stays pointer-only there.
	document.addEventListener("focusin", (event) => {
		const segment = segmentAt(event.target)
		if (!segment) return
		const rect = segment.getBoundingClientRect()
		show(segment, { clientX: rect.left + rect.width / 2, clientY: rect.top })
	})

	document.addEventListener("focusout", (event) => {
		if (segmentAt(event.target) && tooltip) tooltip.hidden = true
	})

	document.addEventListener("pointerleave", () => {
		if (tooltip) tooltip.hidden = true
	})
}

function show(
	segment: Markable,
	at: { clientX: number; clientY: number },
): void {
	const box = ensureTooltip()
	const text = segment.dataset.tooltip ?? ""
	// `role="status"` re-announces on every write, so skip identical ones.
	if (box.textContent !== text) box.textContent = text
	box.hidden = false
	place(box, at)
}
