// @vitest-environment node
import { describe, it, expect, vi } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import { Window } from "happy-dom"

vi.mock("$src/data/gifts", () => ({
	GIFT_IDEAS: [
		{
			name: "A book",
			price: 12,
			shop: "A bookshop",
			link: "https://example.com/book",
			details: ["By Someone", "In <i>A collection</i>"],
			isbn: "9780000000002",
			image: {
				src: "https://m.media-amazon.com/images/I/cover.jpg",
				width: 600,
				height: 900,
			},
		},
		{
			name: "A poster",
			price: 20,
			shop: "A print shop",
			link: "/poster",
			image: { src: "/poster.svg", width: 200, height: 100, format: "svg" },
		},
		{ name: "A trip", price: 150, shop: "A travel agency", link: "/trip" },
	],
}))

const render = async () => {
	const { default: GiftsPage } = await import("../src/pages/gifts.astro")
	const container = await AstroContainer.create()
	return container.renderToString(GiftsPage, {})
}

const renderCards = async () => {
	const { document } = new Window()
	document.body.innerHTML = await render()
	return [...document.body.querySelectorAll("a.card")]
}

describe("gifts page", () => {
	it("asks search engines not to index it", async () => {
		expect(await render()).toContain(
			'<meta name="robots" content="noindex,nofollow">',
		)
	})

	it("renders only the tiers that hold gifts, cheapest first", async () => {
		const html = await render()
		const headings = [...html.matchAll(/<h2 id="([^"]+)"/g)].map(([, id]) => id)
		expect(headings).toEqual(["under_30", "100_and_up"])
	})

	it("renders each gift as a card linking to it, with its details and price", async () => {
		const cards = (await renderCards()).map((card) => ({
			href: card.getAttribute("href"),
			title: card.querySelector("h3")?.textContent?.trim(),
			lines: [...card.querySelectorAll("li")].map((line) =>
				line.textContent?.replace(/\s+/g, " ").trim(),
			),
		}))
		expect(cards).toEqual([
			{
				href: "https://example.com/book",
				title: "A book",
				lines: [
					"By Someone",
					"In A collection",
					"ISBN: 9780000000002",
					"€12 at A bookshop",
				],
			},
			{
				href: "/poster",
				title: "A poster",
				lines: ["€20 at A print shop"],
			},
			{ href: "/trip", title: "A trip", lines: ["€150 at A travel agency"] },
		])
	})

	it("renders detail markup and spells out the ISBN abbreviation", async () => {
		const [card] = await renderCards()
		expect(card?.querySelector("li i")?.textContent).toBe("A collection")
		expect(card?.querySelector("abbr")?.getAttribute("title")).toBe(
			"International Standard Book Number",
		)
	})

	it("renders each image at its declared size, a bundled SVG as is, and no thumbnail without one", async () => {
		const cards = await renderCards()
		const sizes = cards.map((card) => {
			const image = card.querySelector(".card-image img")
			return (
				image && [image.getAttribute("width"), image.getAttribute("height")]
			)
		})
		expect(sizes).toEqual([["600", "900"], ["200", "100"], null])
		expect(cards[1]?.querySelector(".card-image picture")).toBeNull()
	})
})
