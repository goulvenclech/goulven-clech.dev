import { formatDate } from "../../utils"
import type { Review } from "../../pages/api/catalogue/reviews"
import type { Emotion } from "../../pages/api/catalogue/emotions"

/**
 * A web component to display a review card
 */
export class ReviewCard extends HTMLElement {
  private review: Review | null = null
  private emotionsMap: Map<number, Emotion> = new Map()

  // Rating emojis mapping
  private static readonly ratingEmojis: { [key: number]: string } = {
    1: "😡 hated it",
    2: "🙁 disliked it",
    3: "😐 mid",
    4: "😀 liked it",
    5: "😍 loved it",
  }

  constructor() {
    super()
  }

  /**
   * Set the review data and emotions map for the card
   */
  setReviewData(review: Review, emotionsMap: Map<number | string, Emotion>) {
    this.review = review
    this.emotionsMap = emotionsMap as Map<number, Emotion>
    this.render()
    return this
  }

  /**
   * Render the review card
   */
  private render() {
    if (!this.review) return

    // Create card container
    this.innerHTML = ""
    this.className = "card"
    this.setAttribute("href", this.review.source_link || "#")

    // Map emotion IDs from the review to their names using the map
    const reviewEmotionNames = this.review.emotions
      .map((id: number) => {
        const name = this.emotionsMap.get(id)?.name
        return name ? `<i>${name}</i>` : undefined
      })
      .filter((name): name is string => name !== undefined)
      .join(", ")

    const emotionsText = reviewEmotionNames.length > 0 ? reviewEmotionNames : "various emotions"

    const date = formatDate(new Date(this.review.inserted_at))

    const image = this.review.source_img
      ? this.review.source_img
      : "https://picsum.photos/seed/" + this.review.source_id + "/800"

    this.innerHTML = `
			<div class="card-image">
				<img
					src="${image}"
					alt="Cover for ${this.review.source_name || this.review.source_id}"
				/>
			</div>
      <article>
        <h3 class="my-0 leading-8">${this.review.source_name || this.review.source_id}</h3>
        <p class="my-0"><span>${ReviewCard.ratingEmojis[this.review.rating]}, and felt ${emotionsText}.</span></p>
        <p class="my-0">« ${this.review.comment} » — ${date}</p>
      </article>
    `
  }
}

// Register the component
customElements.define("review-card", ReviewCard)
