import { describe, it, expect } from "vitest"
import { ratingText } from "../../src/components/catalogue/reviewUtils"
import { ReviewCard } from "../../src/components/catalogue/ReviewCard"
import type { Review } from "../../src/pages/api/catalogue/reviews"
import type { Emotion } from "../../src/pages/api/catalogue/emotions"

describe("ratingText", () => {
	it("should include media noun for known sources", () => {
		expect(ratingText(5, "IGDB")).toBe("😍 loved this game")
		expect(ratingText(4, "TMDB_MOVIE")).toBe("😀 liked this movie")
		expect(ratingText(2, "OPENLIBRARY")).toBe("🙁 disliked this book")
		expect(ratingText(3, "SPOTIFY")).toBe("😐 meh'd this album")
		expect(ratingText(1, "TMDB_TV")).toBe("😡 hated this show")
		expect(ratingText(4, "BGG")).toBe("😀 liked this board game")
	})

	it("should handle rating 6 (favorite) as adjective without 'this'", () => {
		expect(ratingText(6, "IGDB")).toBe("⭐ favorite game")
		expect(ratingText(6, "OPENLIBRARY")).toBe("⭐ favorite book")
		expect(ratingText(6, "SPOTIFY")).toBe("⭐ favorite album")
	})

	it("should fall back gracefully for unknown source", () => {
		expect(ratingText(5, "UNKNOWN")).toBe("😍 loved this one")
		expect(ratingText(6, "UNKNOWN")).toBe("⭐ favorite")
	})

	it("should return empty string for unknown rating", () => {
		expect(ratingText(0, "IGDB")).toBe("")
		expect(ratingText(7, "IGDB")).toBe("")
	})
})

function mockReview(overrides: Partial<Review> = {}): Review {
	return {
		id: "1",
		source: "IGDB",
		source_id: "12345",
		source_name: "Hollow Knight (2017)",
		source_link: "https://www.igdb.com/games/hollow-knight",
		source_img:
			"https://images.igdb.com/igdb/image/upload/t_cover_big_2x/abc123.jpg",
		source_img_focus_y: 35,
		rating: 5,
		emotions: [1, 2],
		comment: "A masterpiece of exploration and atmosphere",
		inserted_at: "2025-01-15T12:00:00.000Z",
		meta: "Metroidvania | Team Cherry",
		...overrides,
	}
}

const testEmotionsMap = new Map<number, Emotion>([
	[1, { id: "1", emoji: "🤗", name: "comforted", is_deleted: false }],
	[2, { id: "2", emoji: "🌿", name: "nostalgic", is_deleted: false }],
	[3, { id: "3", emoji: "😌", name: "satisfied", is_deleted: false }],
])

describe("ReviewCard", () => {
	it("renders card link with correct attributes", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview(), testEmotionsMap)
		document.body.appendChild(card)

		const link = card.querySelector("a")
		expect(link).not.toBeNull()
		expect(link!.classList.contains("card")).toBe(true)
		expect(link!.getAttribute("href")).toBe(
			"https://www.igdb.com/games/hollow-knight",
		)
		expect(link!.getAttribute("target")).toBe("_blank")
		expect(link!.getAttribute("rel")).toBe("noopener")

		card.remove()
	})

	it("falls back to '#' when source_link is empty", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview({ source_link: "" }), testEmotionsMap)
		document.body.appendChild(card)

		const link = card.querySelector("a")
		expect(link).not.toBeNull()
		expect(link!.getAttribute("href")).toBe("#")

		card.remove()
	})

	it("renders title in h3", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview(), testEmotionsMap)
		document.body.appendChild(card)

		const h3 = card.querySelector("h3")
		expect(h3).not.toBeNull()
		expect(h3!.textContent).toBe("Hollow Knight (2017)")

		card.remove()
	})

	it("falls back to source_id when source_name is empty", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview({ source_name: "" }), testEmotionsMap)
		document.body.appendChild(card)

		const h3 = card.querySelector("h3")
		expect(h3).not.toBeNull()
		expect(h3!.textContent).toBe("12345")

		card.remove()
	})

	it("renders image with correct src", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview(), testEmotionsMap)
		document.body.appendChild(card)

		const img = card.querySelector("img")
		expect(img).not.toBeNull()
		expect(img!.getAttribute("src")).toBe(
			"https://images.igdb.com/igdb/image/upload/t_cover_big_2x/abc123.jpg",
		)

		card.remove()
	})

	it("falls back to picsum image when source_img is empty", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview({ source_img: "" }), testEmotionsMap)
		document.body.appendChild(card)

		const img = card.querySelector("img")
		expect(img).not.toBeNull()
		expect(img!.getAttribute("src")).toContain("picsum.photos/seed/12345")

		card.remove()
	})

	it("sets image focus-y style", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview(), testEmotionsMap)
		document.body.appendChild(card)

		const img = card.querySelector("img")
		expect(img).not.toBeNull()
		expect(img!.getAttribute("style")).toContain("--image-focus-y: 35%")

		card.remove()
	})

	it("handles focus-y of 0", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview({ source_img_focus_y: 0 }), testEmotionsMap)
		document.body.appendChild(card)

		const img = card.querySelector("img")
		expect(img).not.toBeNull()
		expect(img!.getAttribute("style")).toContain("--image-focus-y: 0%")

		card.remove()
	})

	it("no focus-y style when null", () => {
		const card = new ReviewCard()
		card.setReviewData(
			mockReview({ source_img_focus_y: null }),
			testEmotionsMap,
		)
		document.body.appendChild(card)

		const img = card.querySelector("img")
		expect(img).not.toBeNull()
		const style = img!.getAttribute("style")
		expect(style === null || !style.includes("--image-focus-y")).toBe(true)

		card.remove()
	})

	it("shows rating text with media noun", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview(), testEmotionsMap)
		document.body.appendChild(card)

		expect(card.textContent).toContain("😍 loved this game")

		card.remove()
	})

	it("renders emotion names", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview(), testEmotionsMap)
		document.body.appendChild(card)

		expect(card.textContent).toContain("comforted")
		expect(card.textContent).toContain("nostalgic")

		card.remove()
	})

	it("shows 'various emotions' when emotions don't match map", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview({ emotions: [999] }), testEmotionsMap)
		document.body.appendChild(card)

		expect(card.textContent).toContain("various emotions")

		card.remove()
	})

	it("displays comment", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview(), testEmotionsMap)
		document.body.appendChild(card)

		expect(card.textContent).toContain(
			"A masterpiece of exploration and atmosphere",
		)
		expect(card.innerHTML).toContain("«")
		expect(card.innerHTML).toContain("»")

		card.remove()
	})

	it("setReviewData returns the instance", () => {
		const card = new ReviewCard()
		const result = card.setReviewData(mockReview(), testEmotionsMap)
		expect(result).toBe(card)
	})

	it("innerHTML is empty before setReviewData", () => {
		const card = document.createElement("review-card")
		expect(card.innerHTML).toBe("")
	})

	it("image alt text", () => {
		const card = new ReviewCard()
		card.setReviewData(mockReview(), testEmotionsMap)
		document.body.appendChild(card)

		const img = card.querySelector("img")
		expect(img).not.toBeNull()
		expect(img!.getAttribute("alt")).toBe("Cover for Hollow Knight (2017)")

		card.remove()
	})
})
