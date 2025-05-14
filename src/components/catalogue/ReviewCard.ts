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

    const url = this.review.source_link || "#"
    const date = formatDate(new Date(this.review.inserted_at))
    const image = this.review.source_img
      ? this.review.source_img
      : "https://picsum.photos/seed/" + this.review.source_id + "/800"

    const reviewEmotionNames = this.review.emotions
      .map((id) => this.emotionsMap.get(id)?.name)
      .filter((name): name is string => !!name)
      .map((name) => `<i>${name}</i>`)
      .join(", ")

    const emotionsText = reviewEmotionNames || "various emotions"

    // carte cliquable
    this.innerHTML = `
      <a href="${url}" target="_blank" rel="noopener" class="card">
        <div class="card-image">
          <img src="${image}" alt="Cover for ${this.review.source_name || this.review.source_id}" />
        </div>
        <article>
          <h3 class="my-0 leading-8">${this.review.source_name || this.review.source_id}</h3>
          <p class="my-0"><span>${ReviewCard.ratingEmojis[this.review.rating]}, and felt ${emotionsText}.</span></p>
          <p class="my-0">« ${this.review.comment} » — ${date}</p>
        </article>
      </a>
    `
  }
}

// Register the component
customElements.define("review-card", ReviewCard)
