import { beforeAll, describe, expect, it } from "vitest"
import { initChartTooltips } from "../../src/components/catalogue/chartTooltip"

/**
 * The module is a singleton (one shared box, one init guard on <body>), so the
 * tests share one fixture — wiping body.innerHTML later would orphan the box.
 */
describe("chartTooltip", () => {
	let link: HTMLAnchorElement
	const boxOf = () => document.querySelector<HTMLElement>(".chart-tooltip")

	beforeAll(() => {
		document.body.innerHTML =
			'<a href="https://example.com" data-tooltip="The Witness (2016) — 😍 loved this game">cover</a>'
		initChartTooltips()
		const found = document.querySelector("a")
		if (!found) throw new Error("test fixture missing its link")
		link = found
	})

	it("shows the tooltip on focus and hides it on focusout", () => {
		link.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
		const box = boxOf()
		expect(box).not.toBeNull()
		expect(box?.hidden).toBe(false)
		expect(box?.textContent).toContain("The Witness (2016)")

		link.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
		expect(box?.hidden).toBe(true)
	})

	it("shows the tooltip on pointer hover and hides it off the mark", () => {
		link.dispatchEvent(
			new PointerEvent("pointermove", {
				bubbles: true,
				clientX: 40,
				clientY: 40,
			}),
		)
		const box = boxOf()
		expect(box?.hidden).toBe(false)
		expect(box?.textContent).toContain("loved this game")

		document.body.dispatchEvent(
			new PointerEvent("pointermove", { bubbles: true }),
		)
		expect(box?.hidden).toBe(true)
	})
})
