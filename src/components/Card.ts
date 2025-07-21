/**
 * A TypeScript web component used to present a blog entry as a card in search results.
 * ⚠️ Duplication of src/components/Card.astro ⚠️
 * Sadly, Astro can't SSR web components yet. So this component is used in the
 * CSR search script. And the Card.astro is used for SSR, for example to render
 * the default results (before the script is loaded or if JS is disabled).
 */
export class Card extends HTMLElement {
  private cardId!: string
  private cardTitle!: string
  private cardDate!: string
  private cardAbstract!: string
  private cardImage!: string
  private cardImageDark!: string
  private cardImageAlt!: string
  private cardIsPublished!: string

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
    this.cardIsPublished = this.getAttribute("isPublished") || "true"

    const template = document.createElement("template")
    template.innerHTML = `
      <a href="/${this.cardId}" class="card">
				<div class="card-image">
					${
            this.cardImage !== ""
              ? `<img
								class="${this.cardImageDark ? "block dark:hidden" : "block"}"
								src="${this.cardImage}"
								alt="${this.cardImageAlt}"
							/>`
              : ``
          }
					${
            this.cardImageDark !== ""
              ? `<img
								class="hidden dark:block"
								src="${this.cardImageDark}"
								alt="${this.cardImageAlt}"
							/>`
              : ``
          }
				</div>
        <article>
          <h3>
            ${this.cardTitle}
						${ this.cardIsPublished === "false"
							? `<span class="badge">Draft</span>`
							: ``}
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
    imageAlt: string
    isPublished: boolean
  }): this {
    this.setAttribute("title", entry.title)
    this.setAttribute("id", entry.id)
    this.setAttribute("date", entry.date)
    this.setAttribute("tags", entry.tags.length > 0 ? entry.tags.join(", ") : "No tags")
    this.setAttribute("abstract", entry.abstract)
    this.setAttribute("image", entry.image ? entry.image.src : "")
    this.setAttribute("imageDark", entry.imageDark ? entry.imageDark.src : "")
    this.setAttribute("imageAlt", entry.imageAlt)
    this.setAttribute("isPublished", entry.isPublished.toString())
    return this
  }
}

// Register the custom element
customElements.define("search-card", Card)
