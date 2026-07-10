import type { Emotion } from "../../pages/api/catalogue/emotions"
import type { Review } from "../../pages/api/catalogue/reviews"
import { ReviewCard } from "./ReviewCard"
import { CardSkeleton } from "../CardSkeleton"
import { ErrorState } from "../ErrorState"
import { EmptyState } from "../EmptyState"
import "../ResetButton"
import {
	buildReviewParams,
	toQueryString,
	filtersFromUrl,
} from "./catalogueFilters"

const PAGE_SIZE = 5

export interface CatalogueController {
	bootstrap: () => Promise<void>
	loadReviews: (options?: { append?: boolean }) => Promise<void>
}

// State lives in a closure so each instance is independent and testable.
export function createCatalogueController(): CatalogueController {
	let currentOffset = 0

	// Used so stale requests shouldn't win the race
	let inflight: AbortController | null = null

	const allEmotionsMap = new Map<string | number, Emotion>()

	function updateUrlNow(filters: ReturnType<typeof getFilterValues>) {
		const params = buildReviewParams(filters)
		history.replaceState(
			null,
			"",
			`${location.pathname}${toQueryString(params)}`,
		)
	}

	// rating is nullable: the control is hidden, only reachable via URL param.
	function getFilterElements() {
		return {
			query: document.getElementById("query") as HTMLInputElement,
			rating: document.getElementById(
				"rating-filter",
			) as HTMLSelectElement | null,
			source: document.getElementById("source-filter") as HTMLSelectElement,
			emotion: document.getElementById("emotions-filter") as HTMLSelectElement,
			sort: document.getElementById("sort-filter") as HTMLSelectElement,
		}
	}

	async function loadEmotions() {
		const select = document.getElementById("emotions-filter")
		if (!select) return

		select.innerHTML = '<option value="" selected>🎭 all emotions</option>'

		try {
			const response = await fetch("/api/catalogue/emotions")
			if (!response.ok) {
				const body = await response.text()
				throw new Error(
					`HTTP ${response.status} ${response.statusText}: ${body}`,
				)
			}
			const emotions: Emotion[] = await response.json()
			const sortedEmotions = [...emotions].sort((a, b) =>
				a.name.localeCompare(b.name),
			)
			sortedEmotions.forEach((emotion: Emotion) => {
				allEmotionsMap.set(emotion.id, emotion)

				const opt = document.createElement("option")
				opt.value = String(emotion.id)
				opt.textContent = `${emotion.emoji} ${emotion.name}`
				select.appendChild(opt)
			})
		} catch (err) {
			console.error("Failed to load emotions:", err)
			const fallback = document.createElement("option")
			fallback.disabled = true
			fallback.textContent = "⚠️ failed to load emotions"
			select.appendChild(fallback)
			throw err
		}
	}

	function getFilterValues() {
		const elements = getFilterElements()
		return {
			query: elements.query?.value || "",
			rating: elements.rating?.value || "",
			source: elements.source?.value || "",
			emotion: elements.emotion?.value || "",
			sort: elements.sort?.value || "date",
		}
	}

	async function loadReviews({ append = false } = {}) {
		const filters = getFilterValues()
		updateUrlNow(filters)

		const container = document.getElementById("reviews-container")
		if (!container) return

		const loadMoreBtn = document.getElementById("load-more")
		if (append) {
			if (loadMoreBtn) {
				loadMoreBtn.classList.add("hidden")
				const skeleton = new CardSkeleton()
				skeleton.id = "load-more-skeleton"
				container.appendChild(skeleton)
			}
		} else {
			container.innerHTML = ""
			container.appendChild(new CardSkeleton())
		}

		inflight?.abort()
		inflight = new AbortController()

		const params = buildReviewParams(filters, {
			limit: PAGE_SIZE,
			offset: currentOffset,
		})
		const url = `/api/catalogue/reviews${toQueryString(params)}`

		try {
			const response = await fetch(url, { signal: inflight.signal })
			if (!response.ok) {
				const body = await response.text()
				throw new Error(
					`HTTP ${response.status} ${response.statusText}: ${body}`,
				)
			}
			const { reviews, hasMore } = (await response.json()) as {
				reviews: Review[]
				hasMore: boolean
			}

			if (!append) container.innerHTML = ""
			else {
				const skeleton = document.getElementById("load-more-skeleton")
				if (skeleton) skeleton.remove()
			}

			if (reviews.length === 0 && !append) {
				container.appendChild(new EmptyState())
			} else {
				reviews.forEach((review) => {
					const reviewCard = new ReviewCard()
					reviewCard.setReviewData(review, allEmotionsMap)
					container.appendChild(reviewCard)
				})
			}

			if (loadMoreBtn) loadMoreBtn.classList.toggle("hidden", !hasMore)
		} catch (error: any) {
			if (append) {
				const skeleton = document.getElementById("load-more-skeleton")
				if (skeleton) skeleton.remove()
				if (loadMoreBtn) loadMoreBtn.classList.remove("hidden")
			}
			if (error.name === "AbortError") return // out-of-date request
			console.error("Failed to load reviews:", error)
			container.innerHTML = ""
			container.appendChild(new ErrorState())
		}
	}

	function setupFilterListeners() {
		const elements = getFilterElements()

		let debounceTimer: number | undefined
		elements.query?.addEventListener("input", () => {
			clearTimeout(debounceTimer)
			debounceTimer = setTimeout(() => {
				currentOffset = 0
				loadReviews()
			}, 200) as unknown as number
		})

		;[
			elements.rating,
			elements.source,
			elements.emotion,
			elements.sort,
		].forEach((element) =>
			element?.addEventListener("change", () => {
				currentOffset = 0
				loadReviews()
			}),
		)

		elements.query
			?.closest("form")
			?.querySelector("reset-button")
			?.addEventListener("reset-filters", () => {
				currentOffset = 0
				loadReviews()
			})

		document.getElementById("load-more")?.addEventListener("click", () => {
			currentOffset += PAGE_SIZE
			loadReviews({ append: true })
		})
	}

	async function bootstrap() {
		try {
			await loadEmotions()

			// Prevent form submission (which would reload the page)
			const form = document.querySelector("form")
			form?.addEventListener("submit", (e) => {
				e.preventDefault()
			})

			const urlFilters = filtersFromUrl(new URLSearchParams(location.search))
			const elements = getFilterElements()
			if (urlFilters.query !== undefined)
				elements.query.value = urlFilters.query
			if (urlFilters.rating !== undefined && elements.rating)
				elements.rating.value = urlFilters.rating
			if (urlFilters.source !== undefined)
				elements.source.value = urlFilters.source
			if (urlFilters.emotion !== undefined)
				elements.emotion.value = urlFilters.emotion
			if (urlFilters.sort !== undefined) elements.sort.value = urlFilters.sort
			// Programmatic .value= doesn't fire events, notify ResetButton
			form?.dispatchEvent(new Event("change", { bubbles: true }))

			// Wire listeners before the initial fetch so a filter change during it
			// supersedes the request (via AbortController) instead of being dropped.
			setupFilterListeners()
			currentOffset = 0
			await loadReviews()
		} catch (error) {
			console.error("Error initializing catalogue page:", error)
		}
	}

	return { bootstrap, loadReviews }
}

// Hidden helper: fires only if a #sync-igdb button is temporarily added to the page.
function setupSyncIgdb(controller: CatalogueController) {
	document.getElementById("sync-igdb")?.addEventListener("click", async (e) => {
		e.preventDefault()

		const password = prompt("Catalogue password ?")
		if (!password) return

		try {
			const res = await fetch("/api/catalogue/reviews", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password, task: "syncIGDB" }),
			})

			const json = await res.json()
			if (res.ok && json.ok) {
				alert(`✅ ${json.updated} review(s) updated.`)
				await controller.loadReviews()
			} else {
				alert(`❌ ${json.error ?? res.status}`)
			}
		} catch (err) {
			console.error(err)
			alert("❌ Network or server error.")
		}
	})
}

export function initCatalogue() {
	const controller = createCatalogueController()

	if (document.readyState === "loading") {
		document.addEventListener(
			"DOMContentLoaded",
			() => controller.bootstrap(),
			{
				once: true,
			},
		)
	} else {
		controller.bootstrap()
	}

	setupSyncIgdb(controller)
}
