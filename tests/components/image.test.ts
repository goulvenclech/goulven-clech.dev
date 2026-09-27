// @vitest-environment node
import { describe, it, expect } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import { Window } from "happy-dom"
import Image from "../../src/components/images/Image.astro"

const svgSource = {
	src: "/diagram.svg",
	width: 400,
	height: 200,
	format: "svg",
}

const markers = [
	{
		key: "1",
		legend: "Resealable zipper.",
		variant: "success",
		top: 10,
		left: 20,
	},
	{ key: "2", legend: "Robusta.", top: 30, left: 40 },
]

async function renderMarkers(props: Record<string, unknown>) {
	const container = await AstroContainer.create()
	const html = await container.renderToString(Image, {
		props: { src: svgSource, alt: "A coffee label", markers, ...props },
	})
	const { document } = new Window()
	document.body.innerHTML = html
	const rendered = [...document.body.querySelectorAll("*")].filter((element) =>
		element.localName.startsWith("marker-"),
	)
	const hidden = rendered.filter(
		(marker) => marker.getAttribute("aria-hidden") === "true",
	)
	return {
		hidden,
		exposed: rendered.filter((marker) => !hidden.includes(marker)),
	}
}

describe("Image markers", () => {
	it("hides the markers drawn over the image, which the legend describes", async () => {
		const { hidden, exposed } = await renderMarkers({})
		expect(hidden.map((marker) => marker.textContent)).toEqual(["1", "2"])
		expect(
			exposed.map((marker) => [
				marker.textContent,
				marker.nextElementSibling?.textContent,
			]),
		).toEqual([
			["1", "Resealable zipper."],
			["2", "Robusta."],
		])
	})

	it("names legend markers after what their variant stands for", async () => {
		const { exposed } = await renderMarkers({
			markerLabels: { success: "Green flag", primary: "Red flag" },
		})
		expect(exposed.map((marker) => marker.getAttribute("role"))).toEqual([
			"img",
			"img",
		])
		expect(exposed.map((marker) => marker.getAttribute("aria-label"))).toEqual([
			"Green flag",
			"Red flag",
		])
	})

	it("leaves legend markers to their number without labels", async () => {
		const { exposed } = await renderMarkers({})
		expect(exposed.map((marker) => marker.getAttribute("role"))).toEqual([
			null,
			null,
		])
		expect(exposed.map((marker) => marker.getAttribute("aria-label"))).toEqual([
			null,
			null,
		])
	})
})
