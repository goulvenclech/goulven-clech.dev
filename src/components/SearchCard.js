/**
 * A JS vanilla component to display search's results
 * See context -> src/pages/search.astro
 * @param {string} slug - What's the blog entry slug?
 * @param {string} title - What's the blog entry title?
 * @param {string} date - What's the blog entry publish date?
 * @param {string} tags - What's the blog entry tags?
 * @param {string} abstract - What's the blog entry abstract?
 */
export class SearchCard extends HTMLElement {
  constructor() {
    super()
    this.slug = this.attributes.slug.value
    this.title = this.attributes.title.value
    this.date = this.attributes.date.value
    this.tags = this.attributes.tags.value
    this.abstract = this.attributes.abstract.value
  }

  connectedCallback() {
    const template = document.createElement("template")
    template.innerHTML = `<a
            href="/blog/${this.slug}"
          >
          <article class="block overflow-hidden rounded-xl hover:bg-highlight-light dark:hover:bg-highlight-dark px-6 py-5">
            <h3 class="pb-2 text-lg font-bold md:text-xl">
              ${this.title}
            </h3>
            <div class="overflow-hidden text-ellipsis whitespace-nowrap">
              <i class="fa-solid fa-calendar-day w-3.5 md:w-4"></i>
              ${this.date}
              <i class="fa-solid fa-tags ml-3 w-3.5 md:w-4"></i>
              ${this.tags}
            </div>
            <span class="mt-3 text-ellipsis py-0 line-clamp-2">
              ${this.abstract}
            </span>
            </article>
          </a>
    `
    this.appendChild(template.content)
  }
}
