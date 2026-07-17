/**
 * A generic web component to display skeleton loading placeholders for cards
 * Can be used for both blog entries and catalogue reviews
 */
export class CardSkeleton extends HTMLElement {
	private count: number = 3

	constructor() {
		super()
		this.render()
	}

	/**
	 * Set the number of skeleton cards to display
	 */
	setCount(count: number) {
		this.count = count
		this.render()
		return this
	}

	/**
	 * Render the skeleton cards
	 */
	private render() {
		this.innerHTML = "" // Clear existing content

		// Create the specified number of skeleton cards
		for (let i = 0; i < this.count; i++) {
			this.innerHTML += `
        <div
          class="flex animate-pulse gap-5 py-5"
          style="animation-delay: ${i * 0.66}s"
        >
          <div class="bg-alt-light dark:bg-alt-dark hidden h-40 w-37.5 flex-none sm:block"></div>
          <article class="bg-alt-light dark:bg-alt-dark h-40 w-full min-w-0 p-0"></article>
        </div>
      `
		}
	}
}

// Register the component
customElements.define("card-skeleton", CardSkeleton)
