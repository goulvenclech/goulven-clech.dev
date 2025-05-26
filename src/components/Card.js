/**
 * A JS vanilla component used to present a blog entry as a card in search results.
 * Mainly use in this inline script -> src/pages/search.astro
 * ⚠️ Duplication of src/components/Card.astro ⚠️
 * Sadly, Astro can't SSR web components yet. So this components is used in the
 * CSR search.astro script. And the Card.astro is used for SSR, for example to render
 * the default results (before the script is loaded or if JS is disabled).
 */
export class Card extends HTMLElement {
  connectedCallback() {
    // Not using a constructor because Search.astro calls this component in fragments,
    // and the constructor checks for attributes before they are set.
    this.id = this.attributes.id.value
    this.title = this.attributes.title.value
    this.date = this.attributes.date.value
    this.tags = this.attributes.tags.value
    this.abstract = this.attributes.abstract.value
    this.image = this.attributes.image.value
    this.imageDark = this.attributes.imageDark.value
    this.imageAlt = this.attributes.imageAlt.value
		this.isPublished = this.attributes.isPublished.value
    // The good old way of templating 👴
    const template = document.createElement("template")
    template.innerHTML = `
      <a href="/${this.id}" class="card">
				<div class="card-image">
					${
            this.image !== ""
              ? `<img
								class="${this.imageDark ? "block dark:hidden" : "block"}"
								src="${this.image}"
								alt="${this.imageAlt}"
							/>`
              : ``
          }
					${
            this.imageDark !== ""
              ? `<img
								class="hidden dark:block"
								src="${this.imageDark}"
								alt="${this.imageAlt}"
							/>`
              : ``
          }
				</div>
        <article>
          <h3 class="my-0 leading-8">
            ${this.title}
						${ this.isPublished == "false"
							? `<span class="badge">Draft</span>`
							: ``}
          </h3>
          <span class="my-0 text-ellipsis py-0 line-clamp-4 sm:line-clamp-3">
            ${this.abstract} —<span class="whitespace-nowrap"> ${this.date}</span>
          </span>
        </article>
      </a>
    `
    this.appendChild(template.content)
  }
}
