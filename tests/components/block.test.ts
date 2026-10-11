// @vitest-environment node
import { describe, it, expect } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import { Window } from "happy-dom"
import Block from "../../src/components/Block.astro"
import InternalImage from "../../src/components/images/InternalImage.astro"

const cover = "https://m.media-amazon.com/images/I/cover.jpg"
const logo = { src: "/logo.svg", width: 200, height: 100, format: "svg" }

async function renderDocument(
	component: typeof Block | typeof InternalImage,
	props: Record<string, unknown>,
) {
	const container = await AstroContainer.create()
	const { document } = new Window()
	document.body.innerHTML = await container.renderToString(component, {
		props,
		slots: { default: "<h3>A book</h3>" },
	})
	return document
}

describe("Block", () => {
	it("exposes the image ratio so the thumbnail is sized before it loads", async () => {
		const document = await renderDocument(Block, {
			to: "/book",
			image: cover,
			imageWidth: 300,
			imageHeight: 600,
		})
		expect(document.querySelector(".card-image")?.getAttribute("style")).toBe(
			"--card-image-ratio: 0.5",
		)
	})

	it("sizes a local image from its metadata when no size is given", async () => {
		const document = await renderDocument(Block, { to: "/logo", image: logo })
		const image = document.querySelector(".card-image img")
		expect(document.querySelector(".card-image")?.getAttribute("style")).toBe(
			"--card-image-ratio: 2",
		)
		expect(image?.getAttribute("width")).toBe("200")
		expect(image?.getAttribute("height")).toBe("100")
	})

	it("ignores a lone dimension", async () => {
		const document = await renderDocument(Block, {
			to: "/logo",
			image: logo,
			imageWidth: 300,
		})
		const image = document.querySelector(".card-image img")
		expect(document.querySelector(".card-image")?.getAttribute("style")).toBe(
			"--card-image-ratio: 2",
		)
		expect(image?.getAttribute("width")).toBe("200")
		expect(image?.getAttribute("height")).toBe("100")
	})

	it("paints no placeholder background for a remote image", async () => {
		const document = await renderDocument(Block, {
			to: "/book",
			image: cover,
			imageWidth: 300,
			imageHeight: 600,
		})
		const image = document.querySelector(".card-image img")
		expect(image?.hasAttribute("style")).toBe(false)
		expect(image?.hasAttribute("onload")).toBe(false)
	})
})

describe("InternalImage", () => {
	it("paints the placeholder behind the image until it loads", async () => {
		const document = await renderDocument(InternalImage, {
			source: cover,
			alt: "",
			width: 300,
			height: 600,
			placeholderURL: "data:image/webp;base64,AAAA",
		})
		const image = document.querySelector("img")
		expect(image?.getAttribute("style")).toContain(
			"background-image: url(data:image/webp;base64,AAAA)",
		)
		expect(image?.hasAttribute("onload")).toBe(true)
	})
})
