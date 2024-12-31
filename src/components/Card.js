/**
 * A JS vanilla component used to present a blog entry as a card in search results.
 * Mainly use in this inline script -> src/pages/search.astro
 * ⚠️ Duplication of src/components/Card.astro ⚠️
 * Sadly, Astro can't SSR web components yet. So this components is used in the
 * CSR search.astro script. And the Card.astro is used for SSR, for example to render
 * the default results (before the script is loaded or if JS is disabled).
 * @param {string} id - What's the blog entry id?
 * @param {string} title - What's the blog entry title?
 * @param {string} date - What's the blog entry publish date?
 * @param {string} tags - What's the blog entry tags?
 * @param {string} abstract - What's the blog entry abstract?
 * @param {string} image - What's the blog entry cover?
 * @param {string} imageAlt - What's the blog entry cover alt?
 */
export class Card extends HTMLElement {
  constructor() {
    super()
    this.id = this.attributes.id.value
    this.title = this.attributes.title.value
    this.date = this.attributes.date.value
    this.tags = this.attributes.tags.value
    this.abstract = this.attributes.abstract.value
    this.image = this.attributes.image.value
    this.imageAlt = this.attributes.imageAlt.value
  }

  connectedCallback() {
    const template = document.createElement("template")
    // The good old way of templating 👴
    template.innerHTML = `
      <a href="/${this.id}" class="card">
      ${
        this.image !== ""
          ? `<img
            src="${this.image}"
            alt="${this.image_alt}"
          />
        `
          : ``
      }
        <article>
          <h3 class="my-0 leading-relaxed">
            ${this.title}
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
