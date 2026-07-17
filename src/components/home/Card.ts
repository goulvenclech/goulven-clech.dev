import type { BlogEntry } from "../../blogUtils"

/**
 * A TypeScript web component used to present a blog entry as a card in search results.
 */
export class Card extends HTMLElement {
	private cardId!: string
	private cardTitle!: string
	private cardDate!: string
	private cardAbstract!: string
	private cardIsPublished!: string

	connectedCallback() {
		// Not using a constructor because Search.astro calls this component in fragments,
		// and the constructor checks for attributes before they are set.
		this.cardId = this.getAttribute("id") || ""
		this.cardTitle = this.getAttribute("title") || ""
		this.cardDate = this.getAttribute("date") || ""
		this.cardAbstract = this.getAttribute("abstract") || ""
		this.cardIsPublished = this.getAttribute("isPublished") || "true"

		const template = document.createElement("template")
		template.innerHTML = `
      <a href="/${this.cardId}" class="card">
        <article>
          <h3>
            ${this.cardTitle}
						${this.cardIsPublished === "false" ? `<span class="badge">Draft</span>` : ``}
          </h3>
          <p class="text-ellipsis line-clamp-4 sm:line-clamp-3">
            ${this.cardAbstract} –<span class="whitespace-nowrap"> ${this.cardDate}</span>
          </p>
        </article>
      </a>
    `
		this.appendChild(template.content)
	}

	// Method to populate card from blog entry data
	fromBlogEntry(entry: Omit<BlogEntry, "year">): this {
		this.setAttribute("title", entry.title)
		this.setAttribute("id", entry.id)
		this.setAttribute("date", entry.date)
		this.setAttribute(
			"tags",
			entry.tags.length > 0 ? entry.tags.join(", ") : "No tags",
		)
		this.setAttribute("abstract", entry.abstract)
		this.setAttribute("isPublished", entry.isPublished.toString())
		return this
	}
}

// Register the custom element
customElements.define("search-card", Card)
