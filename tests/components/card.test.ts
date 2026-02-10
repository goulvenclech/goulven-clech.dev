import { describe, it, expect } from "vitest"
import type { BlogEntry } from "../../src/utils"

// Import components to trigger customElements.define()
import { Card } from "../../src/components/card/Card"
import { EmptyState } from "../../src/components/card/EmptyState"

function mockBlogEntry(overrides: Partial<BlogEntry> = {}): BlogEntry {
	return {
		id: "2025/test-entry",
		title: "Test Entry Title",
		date: "18 January 2025",
		year: 2025,
		tags: ["typescript", "testing"],
		abstract: "A test blog entry abstract.",
		imageAlt: "Test cover",
		isPublished: true,
		...overrides,
	}
}

describe("Card", () => {
	it("renders a link with correct href from blog entry id", () => {
		const card = new Card()
		card.fromBlogEntry(mockBlogEntry({ id: "2025/my-post" }))
		document.body.appendChild(card)

		const link = card.querySelector("a")
		expect(link).not.toBeNull()
		expect(link!.getAttribute("href")).toBe("/2025/my-post")

		card.remove()
	})

	it("renders the title in an h3", () => {
		const card = new Card()
		card.fromBlogEntry(mockBlogEntry({ title: "Hello World" }))
		document.body.appendChild(card)

		const h3 = card.querySelector("h3")
		expect(h3).not.toBeNull()
		expect(h3!.textContent).toContain("Hello World")

		card.remove()
	})

	it("renders abstract and date in the paragraph", () => {
		const card = new Card()
		card.fromBlogEntry(
			mockBlogEntry({ abstract: "Some abstract", date: "5 March 2025" }),
		)
		document.body.appendChild(card)

		const p = card.querySelector("p")
		expect(p).not.toBeNull()
		expect(p!.textContent).toContain("Some abstract")
		expect(p!.textContent).toContain("5 March 2025")

		card.remove()
	})

	it("shows a Draft badge when isPublished is false", () => {
		const card = new Card()
		card.fromBlogEntry(mockBlogEntry({ isPublished: false }))
		document.body.appendChild(card)

		const badge = card.querySelector(".badge")
		expect(badge).not.toBeNull()
		expect(badge!.textContent).toBe("Draft")

		card.remove()
	})

	it("does not show a Draft badge when isPublished is true", () => {
		const card = new Card()
		card.fromBlogEntry(mockBlogEntry({ isPublished: true }))
		document.body.appendChild(card)

		const badge = card.querySelector(".badge")
		expect(badge).toBeNull()

		card.remove()
	})

	it("renders an image when image src is provided", () => {
		const card = new Card()
		card.fromBlogEntry(mockBlogEntry({ image: { src: "/img/cover.webp" } }))
		document.body.appendChild(card)

		const img = card.querySelector("img")
		expect(img).not.toBeNull()
		expect(img!.getAttribute("src")).toBe("/img/cover.webp")

		card.remove()
	})

	it("does not render an img tag when no image is provided", () => {
		const card = new Card()
		card.fromBlogEntry(mockBlogEntry({ image: undefined }))
		document.body.appendChild(card)

		const img = card.querySelector("img")
		expect(img).toBeNull()

		card.remove()
	})

	it("sets --image-focus-y custom property when imageFocusY is provided", () => {
		const card = new Card()
		card.fromBlogEntry(mockBlogEntry({ imageFocusY: 30 }))
		document.body.appendChild(card)

		const imageDiv = card.querySelector(".card-image")
		expect(imageDiv).not.toBeNull()
		expect(imageDiv!.getAttribute("style")).toContain("--image-focus-y: 30%")

		card.remove()
	})

	it("does not set --image-focus-y when imageFocusY is not provided", () => {
		const card = new Card()
		card.fromBlogEntry(mockBlogEntry({ imageFocusY: undefined }))
		document.body.appendChild(card)

		const imageDiv = card.querySelector(".card-image")
		expect(imageDiv).not.toBeNull()
		const style = imageDiv!.getAttribute("style")
		expect(style === null || !style.includes("--image-focus-y")).toBe(true)

		card.remove()
	})

	it("fromBlogEntry returns the card instance for chaining", () => {
		const card = new Card()
		const result = card.fromBlogEntry(mockBlogEntry())
		expect(result).toBe(card)
	})
})

describe("EmptyState", () => {
	it("renders with default message", () => {
		const state = new EmptyState()
		document.body.appendChild(state)

		const p = state.querySelector("p")
		expect(p).not.toBeNull()
		expect(p!.textContent).toBe("No results found...")

		state.remove()
	})

	it("renders with a custom message via setMessage()", () => {
		const state = new EmptyState()
		state.setMessage("No entries found...")
		document.body.appendChild(state)

		const p = state.querySelector("p")
		expect(p).not.toBeNull()
		expect(p!.textContent).toBe("No entries found...")

		state.remove()
	})

	it("setMessage returns the instance for chaining", () => {
		const state = new EmptyState()
		const result = state.setMessage("test")
		expect(result).toBe(state)
	})
})
