/**
 * A reusable web component that resets form controls to their default values.
 * Accepts a `defaults` attribute — a JSON-encoded map of {controlId → defaultValue}.
 * Auto-discovers its parent form and toggles visibility based on active filters.
 */
export class ResetButton extends HTMLElement {
	private defaults: Record<string, string> = {}
	private form: HTMLFormElement | null = null
	private button: HTMLButtonElement | null = null
	private handleFormInput = () => this.updateVisibility()
	private handleFormChange = () => this.updateVisibility()
	private handleClick = () => this.reset()

	connectedCallback() {
		const raw = this.getAttribute("defaults")
		if (raw) {
			this.defaults = JSON.parse(raw)
		}

		this.replaceChildren()

		const template = document.createElement("template")
		template.innerHTML = `<button type="button" class="border-primary text-primary hover:bg-primary hover:text-body-light dark:hover:text-body-dark cursor-pointer rounded-full border transition-colors px-2 no-underline border-box leading-4.5">reset</button>`
		this.appendChild(template.content)

		this.classList.add("hidden")

		this.button = this.querySelector("button")
		this.form = this.closest("form")

		this.button?.addEventListener("click", this.handleClick)

		if (this.form) {
			this.form.addEventListener("input", this.handleFormInput)
			this.form.addEventListener("change", this.handleFormChange)
		}

		this.updateVisibility()
	}

	disconnectedCallback() {
		this.button?.removeEventListener("click", this.handleClick)
		if (this.form) {
			this.form.removeEventListener("input", this.handleFormInput)
			this.form.removeEventListener("change", this.handleFormChange)
		}
	}

	hasActiveFilters(): boolean {
		if (!this.form) return false
		for (const [id, defaultValue] of Object.entries(this.defaults)) {
			const element = this.form.querySelector<
				HTMLInputElement | HTMLSelectElement
			>(`#${id}`)
			if (element && element.value !== defaultValue) return true
		}
		return false
	}

	updateVisibility() {
		this.classList.toggle("hidden", !this.hasActiveFilters())
	}

	private reset() {
		if (!this.form) return
		for (const [id, defaultValue] of Object.entries(this.defaults)) {
			const element = this.form.querySelector<
				HTMLInputElement | HTMLSelectElement
			>(`#${id}`)
			if (element) element.value = defaultValue
		}
		this.dispatchEvent(new CustomEvent("reset-filters", { bubbles: true }))
		this.updateVisibility()
	}
}

customElements.define("reset-button", ResetButton)
