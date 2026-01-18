/**
 * A TypeScript web component used to present a blog entry as a card in search results.
 */
export class Card extends HTMLElement {
	private cardId!: string
	private cardTitle!: string
	private cardDate!: string
	private cardAbstract!: string
	private cardImage!: string
	private cardImageDark!: string
	private cardImageAlt!: string
	private cardImagePlaceholder!: string
	private cardImageDarkPlaceholder!: string
	private cardIsPublished!: string
	private cardImageFocusY!: string

	connectedCallback() {
		// Not using a constructor because Search.astro calls this component in fragments,
		// and the constructor checks for attributes before they are set.
		this.cardId = this.getAttribute("id") || ""
		this.cardTitle = this.getAttribute("title") || ""
		this.cardDate = this.getAttribute("date") || ""
		this.cardAbstract = this.getAttribute("abstract") || ""
		this.cardImage = this.getAttribute("image") || ""
		this.cardImageDark = this.getAttribute("imageDark") || ""
		this.cardImageAlt = this.getAttribute("imageAlt") || ""
		this.cardImagePlaceholder = this.getAttribute("imagePlaceholder") || ""
		this.cardImageDarkPlaceholder =
			this.getAttribute("imageDarkPlaceholder") || ""
		this.cardIsPublished = this.getAttribute("isPublished") || "true"
		this.cardImageFocusY = this.getAttribute("imageFocusY") || ""

		// Build optional style attribute for vertical image focus.
		const imageFocusStyle =
			this.cardImageFocusY !== ""
				? ` style="--image-focus-y: ${this.cardImageFocusY}%"`
				: ""

		const template = document.createElement("template")
		template.innerHTML = `
      <a href="/${this.cardId}" class="card">
				<div class="card-image"${imageFocusStyle}>
					${
						this.cardImage !== ""
							? `<img
								class="${this.cardImageDark ? "block dark:hidden" : "block"}"
								src="${this.cardImage}"
								alt="${this.cardImageAlt}"
								style="background-size: cover; background-image: url(${this.cardImagePlaceholder}); image-rendering: auto;"
								onload="this.style.backgroundSize = null; this.style.backgroundImage = null; this.style.imageRendering = null; this.style.fontSize = null; this.style.color = null; this.removeAttribute('onload');"
							/>`
							: ``
					}
					${
						this.cardImageDark !== ""
							? `<img
								class="hidden dark:block"
								src="${this.cardImageDark}"
								alt="${this.cardImageAlt}"
								style="background-size: cover; background-image: url(${this.cardImageDarkPlaceholder || this.cardImagePlaceholder}); image-rendering: auto;"
								onload="this.style.backgroundSize = null; this.style.backgroundImage = null; this.style.imageRendering = null; this.style.fontSize = null; this.style.color = null; this.removeAttribute('onload');"
							/>`
							: ``
					}
				</div>
        <article>
          <h3>
            ${this.cardTitle}
						${this.cardIsPublished === "false" ? `<span class="badge">Draft</span>` : ``}
          </h3>
          <p class="text-ellipsis line-clamp-4 sm:line-clamp-3">
            ${this.cardAbstract} —<span class="whitespace-nowrap"> ${this.cardDate}</span>
          </p>
        </article>
      </a>
    `
		this.appendChild(template.content)
	}

	// Method to populate card from blog entry data
	fromBlogEntry(entry: {
		title: string
		id: string
		date: string
		tags: string[]
		abstract: string
		image?: { src: string }
		imageDark?: { src: string }
		imagePlaceholder?: string
		imageDarkPlaceholder?: string
		imageAlt: string
		isPublished: boolean
		imageFocusY?: number
	}): this {
		this.setAttribute("title", entry.title)
		this.setAttribute("id", entry.id)
		this.setAttribute("date", entry.date)
		this.setAttribute(
			"tags",
			entry.tags.length > 0 ? entry.tags.join(", ") : "No tags",
		)
		this.setAttribute("abstract", entry.abstract)
		this.setAttribute("image", entry.image ? entry.image.src : "")
		this.setAttribute("imageDark", entry.imageDark ? entry.imageDark.src : "")
		this.setAttribute("imagePlaceholder", entry.imagePlaceholder || "")
		this.setAttribute("imageDarkPlaceholder", entry.imageDarkPlaceholder || "")
		this.setAttribute("imageAlt", entry.imageAlt)
		this.setAttribute("isPublished", entry.isPublished.toString())
		if (typeof entry.imageFocusY === "number")
			this.setAttribute("imageFocusY", String(entry.imageFocusY))
		return this
	}
}

// Register the custom element
customElements.define("search-card", Card)
