/**
 * A web component to display skeleton loading placeholders for review cards
 * Based on the Astro component design
 */
export class ReviewCardSkeleton extends HTMLElement {
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
          class="my-5 flex animate-pulse flex-col gap-5 sm:flex-row"
          style="animation-delay: ${i * 0.66}s"
        >
          <div class="bg-alt-light dark:bg-alt-dark h-[153.25px] w-full rounded sm:max-w-[150px]"></div>
          <article class="bg-alt-light dark:bg-alt-dark h-[153.25px] w-full min-w-0 rounded p-0"></article>
        </div>
      `
    }
  }
}

// Register the component
customElements.define("review-card-skeleton", ReviewCardSkeleton)
