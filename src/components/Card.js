/**
 * A JS vanilla component used to present a blog entry as a card in search results.
 * Mainly use in this inline script -> src/pages/search.astro
 * ⚠️ Duplication of src/components/Card.astro ⚠️
 * Sadly, Astro can't SSR web components yet. So this components is used in the
 * CSR search.astro script. And the Card.astro is used for SSR, for example to render
 * the default results (before the script is loaded or if JS is disabled).
 * @param {string} slug - What's the blog entry slug?
 * @param {string} title - What's the blog entry title?
 * @param {string} date - What's the blog entry publish date?
 * @param {string} tags - What's the blog entry tags?
 * @param {string} abstract - What's the blog entry abstract?
 * @param {string} image - What's the blog entry cover?
 * @param {string} imageAlt - What's the blog entry cover alt?
 * @param {number} index - Used to alternate which side the cover is displayed on
 */
export class Card extends HTMLElement {
  constructor() {
    super()
    this.slug = this.attributes.slug.value
    this.title = this.attributes.title.value
    this.date = this.attributes.date.value
    this.tags = this.attributes.tags.value
    this.abstract = this.attributes.abstract.value
    this.image = this.attributes.image.value
    this.imageAlt = this.attributes.imageAlt.value
    this.index = this.attributes.index.value
  }

  connectedCallback() {
    const template = document.createElement("template")
    // The good old way of templating 👴
    template.innerHTML = `
      <a href="/${
        this.slug
      }" class="flex flex-col sm:flex-row overflow-hidden rounded hover:bg-alt-light dark:hover:bg-alt-dark">
      ${
        this.image !== ""
          ? `<img
            class="${this.getOrder(this.index)} max-h-36 w-auto object-cover sm:h-[162.5px] sm:max-h-48 sm:w-[150px]"
            src="${this.image}"
            alt="${this.image_alt}"
          />
        `
          : ``
      }
        <article class="px-6 py-5 min-w-0">
          <h3 class="mb-0 mt-0 leading-relaxed">
            ${this.title}
          </h3>
          <span class="mt-0 text-ellipsis py-0 line-clamp-4 sm:line-clamp-3">
            ${this.abstract} —<span class="whitespace-nowrap"> ${this.date}</span>
          </span>
        </article>
      </a>
    `
    this.appendChild(template.content)
  }

  /**
   * Based on the index, return css class to alternate which side the cover
   * is displayed on.
   * @param {*} index
   * @returns css class string
   */
  getOrder(index) {
    if (index % 2 == 1) {
      return "sm:order-2"
    } else {
      return ""
    }
  }
}
