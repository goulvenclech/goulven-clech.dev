import { describe, it, expect, vi } from "vitest"
import { ResetButton } from "../../src/components/controls/ResetButton"

/** Helper: build a form with controls and a reset-button inside it */
function createForm(
	controls: Array<{
		tag: "input" | "select"
		id: string
		value: string
		options?: string[]
	}>,
	defaults: Record<string, string>,
): { form: HTMLFormElement; resetButton: ResetButton } {
	const form = document.createElement("form")

	for (const ctrl of controls) {
		const el = document.createElement(ctrl.tag)
		el.id = ctrl.id
		if (ctrl.tag === "select" && ctrl.options) {
			for (const optValue of ctrl.options) {
				const option = document.createElement("option")
				option.value = optValue
				option.textContent = optValue
				el.appendChild(option)
			}
		}
		el.value = ctrl.value
		form.appendChild(el)
	}

	const resetButton = document.createElement(
		"reset-button",
	) as unknown as ResetButton
	resetButton.setAttribute("defaults", JSON.stringify(defaults))
	form.appendChild(resetButton)
	document.body.appendChild(form)

	return { form, resetButton }
}

function cleanup(form: HTMLFormElement) {
	form.remove()
}

describe("ResetButton", () => {
	it("is hidden when all controls match their defaults", () => {
		const defaults = { query: "", tag: "" }
		const { form, resetButton } = createForm(
			[
				{ tag: "input", id: "query", value: "" },
				{ tag: "select", id: "tag", value: "", options: ["", "ts", "js"] },
			],
			defaults,
		)

		expect(resetButton.classList.contains("hidden")).toBe(true)

		cleanup(form)
	})

	it("becomes visible when a control differs from its default", () => {
		const defaults = { query: "", tag: "" }
		const { form, resetButton } = createForm(
			[
				{ tag: "input", id: "query", value: "" },
				{ tag: "select", id: "tag", value: "", options: ["", "ts"] },
			],
			defaults,
		)

		const queryInput = form.querySelector<HTMLInputElement>("#query")!
		queryInput.value = "hello"
		form.dispatchEvent(new Event("input"))

		expect(resetButton.classList.contains("hidden")).toBe(false)

		cleanup(form)
	})

	it("resets all controls to their defaults on click", () => {
		const defaults = { query: "", tag: "", year: "" }
		const { form, resetButton } = createForm(
			[
				{ tag: "input", id: "query", value: "search term" },
				{
					tag: "select",
					id: "tag",
					value: "typescript",
					options: ["", "typescript", "js"],
				},
				{
					tag: "select",
					id: "year",
					value: "2025",
					options: ["", "2024", "2025"],
				},
			],
			defaults,
		)

		const button = resetButton.querySelector("button")!
		button.click()

		expect(form.querySelector<HTMLInputElement>("#query")!.value).toBe("")
		expect(form.querySelector<HTMLSelectElement>("#tag")!.value).toBe("")
		expect(form.querySelector<HTMLSelectElement>("#year")!.value).toBe("")

		cleanup(form)
	})

	it("dispatches a reset-filters custom event on click", () => {
		const defaults = { query: "" }
		const { form, resetButton } = createForm(
			[{ tag: "input", id: "query", value: "something" }],
			defaults,
		)

		const handler = vi.fn()
		resetButton.addEventListener("reset-filters", handler)

		const button = resetButton.querySelector("button")!
		button.click()

		expect(handler).toHaveBeenCalledOnce()

		cleanup(form)
	})

	it("works with select elements", () => {
		const defaults = { source: "", sort: "date" }
		const { form, resetButton } = createForm(
			[
				{
					tag: "select",
					id: "source",
					value: "IGDB",
					options: ["", "IGDB", "TMDB"],
				},
				{
					tag: "select",
					id: "sort",
					value: "rating",
					options: ["date", "rating"],
				},
			],
			defaults,
		)

		// Both differ from defaults, so button should be visible
		expect(resetButton.classList.contains("hidden")).toBe(false)

		const button = resetButton.querySelector("button")!
		button.click()

		expect(form.querySelector<HTMLSelectElement>("#source")!.value).toBe("")
		expect(form.querySelector<HTMLSelectElement>("#sort")!.value).toBe("date")
		expect(resetButton.classList.contains("hidden")).toBe(true)

		cleanup(form)
	})

	it("handles non-empty default values correctly", () => {
		const defaults = { sort: "date" }
		const { form, resetButton } = createForm(
			[
				{
					tag: "select",
					id: "sort",
					value: "date",
					options: ["date", "rating"],
				},
			],
			defaults,
		)

		// Value matches default — should be hidden
		expect(resetButton.classList.contains("hidden")).toBe(true)
		expect(resetButton.hasActiveFilters()).toBe(false)

		// Change to non-default value
		form.querySelector<HTMLSelectElement>("#sort")!.value = "rating"
		form.dispatchEvent(new Event("change"))

		expect(resetButton.classList.contains("hidden")).toBe(false)
		expect(resetButton.hasActiveFilters()).toBe(true)

		cleanup(form)
	})

	it("updates visibility on change events", () => {
		const defaults = { source: "" }
		const { form, resetButton } = createForm(
			[
				{
					tag: "select",
					id: "source",
					value: "",
					options: ["", "TMDB_MOVIE", "IGDB"],
				},
			],
			defaults,
		)

		expect(resetButton.classList.contains("hidden")).toBe(true)

		form.querySelector<HTMLSelectElement>("#source")!.value = "TMDB_MOVIE"
		form.dispatchEvent(new Event("change"))

		expect(resetButton.classList.contains("hidden")).toBe(false)

		cleanup(form)
	})

	it("stays hidden when values are set programmatically without events", () => {
		const defaults = { query: "", tag: "" }
		const { form, resetButton } = createForm(
			[
				{ tag: "input", id: "query", value: "" },
				{ tag: "select", id: "tag", value: "", options: ["", "ts", "js"] },
			],
			defaults,
		)

		expect(resetButton.classList.contains("hidden")).toBe(true)

		// Programmatic .value = does NOT fire events (DOM spec)
		form.querySelector<HTMLInputElement>("#query")!.value =
			"software engineering"
		form.querySelector<HTMLSelectElement>("#tag")!.value = "ts"

		// Without a dispatched event, the button stays hidden
		expect(resetButton.classList.contains("hidden")).toBe(true)

		cleanup(form)
	})

	it("becomes visible when a change event is dispatched after programmatic value set", () => {
		const defaults = { query: "", tag: "" }
		const { form, resetButton } = createForm(
			[
				{ tag: "input", id: "query", value: "" },
				{ tag: "select", id: "tag", value: "", options: ["", "ts", "js"] },
			],
			defaults,
		)

		expect(resetButton.classList.contains("hidden")).toBe(true)

		// Simulate URL param restoration: set values programmatically then dispatch event
		form.querySelector<HTMLInputElement>("#query")!.value =
			"software engineering"
		form.querySelector<HTMLSelectElement>("#tag")!.value = "ts"
		form.dispatchEvent(new Event("change", { bubbles: true }))

		expect(resetButton.classList.contains("hidden")).toBe(false)

		cleanup(form)
	})
})
