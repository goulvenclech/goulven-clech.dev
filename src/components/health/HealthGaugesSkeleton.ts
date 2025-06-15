/** Simple skeleton when data is loading. */
export class HealthGaugesSkeleton extends HTMLElement {
  constructor() {
    super()
    this.classList.add("contents")
    this.render()
  }

  private render() {
    this.innerHTML = `
      <div class="bg-alt-light dark:bg-alt-dark flex aspect-square w-1/8 items-center justify-center rounded-full text-center text-xs animate-pulse" />
    `
  }
}

customElements.define("health-gauges-skeleton", HealthGaugesSkeleton)
