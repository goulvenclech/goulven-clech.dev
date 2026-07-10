import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createCatalogueController } from "../../src/components/catalogue/catalogueClient"

// The form is interactive before emotions/reviews finish loading; these tests
// pin that a filter change during that window is never dropped.

const FORM_HTML = `
	<form>
		<input id="query" type="text" />
		<select id="source-filter">
			<option value="" selected>everything</option>
			<option value="TMDB_MOVIE">movies</option>
		</select>
		<select id="emotions-filter">
			<option value="" selected>all emotions</option>
		</select>
		<select id="sort-filter">
			<option value="date" selected>by date</option>
			<option value="rating">by rating</option>
		</select>
	</form>
	<div id="reviews-container"></div>
	<button id="load-more"></button>
`

function jsonResponse(data: unknown): Response {
	return {
		ok: true,
		status: 200,
		statusText: "OK",
		json: async () => data,
		text: async () => JSON.stringify(data),
	} as unknown as Response
}

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((r) => (resolve = r))
	return { promise, resolve }
}

/** Flush pending microtasks (fetch/json resolutions) by yielding a macrotask. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function selectSource(value: string) {
	const source = document.getElementById("source-filter") as HTMLSelectElement
	source.value = value
	source.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("catalogueClient", () => {
	let reviewsRequests: string[]

	beforeEach(() => {
		document.body.innerHTML = FORM_HTML
		reviewsRequests = []
		vi.spyOn(history, "replaceState").mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
		document.body.innerHTML = ""
	})

	it("fetches emotions then an initial page of reviews on bootstrap", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn((input: RequestInfo | URL) => {
				const url = String(input)
				if (url.startsWith("/api/catalogue/emotions"))
					return Promise.resolve(jsonResponse([]))
				reviewsRequests.push(url)
				return Promise.resolve(jsonResponse({ reviews: [], hasMore: false }))
			}),
		)

		await createCatalogueController().bootstrap()

		expect(reviewsRequests).toHaveLength(1)
		expect(reviewsRequests[0]).not.toContain("source=")
	})

	it("fires a fresh request when a filter changes during the initial load", async () => {
		const firstReviews = deferred<Response>()
		vi.stubGlobal(
			"fetch",
			vi.fn((input: RequestInfo | URL) => {
				const url = String(input)
				if (url.startsWith("/api/catalogue/emotions"))
					return Promise.resolve(jsonResponse([]))
				reviewsRequests.push(url)
				return reviewsRequests.length === 1
					? firstReviews.promise
					: Promise.resolve(jsonResponse({ reviews: [], hasMore: false }))
			}),
		)

		const bootstrapped = createCatalogueController().bootstrap()
		await flush()

		expect(reviewsRequests).toHaveLength(1)

		selectSource("TMDB_MOVIE")

		expect(reviewsRequests).toHaveLength(2)
		expect(reviewsRequests[1]).toContain("source=TMDB_MOVIE")

		firstReviews.resolve(jsonResponse({ reviews: [], hasMore: false }))
		await bootstrapped
	})

	it("reloads reviews when a filter changes after the initial load", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn((input: RequestInfo | URL) => {
				const url = String(input)
				if (url.startsWith("/api/catalogue/emotions"))
					return Promise.resolve(jsonResponse([]))
				reviewsRequests.push(url)
				return Promise.resolve(jsonResponse({ reviews: [], hasMore: false }))
			}),
		)

		await createCatalogueController().bootstrap()
		expect(reviewsRequests).toHaveLength(1)

		selectSource("TMDB_MOVIE")
		await flush()

		expect(reviewsRequests).toHaveLength(2)
		expect(reviewsRequests[1]).toContain("source=TMDB_MOVIE")
	})
})
