/** Marks the current day. */
export class HealthToday extends HTMLElement {
  constructor() {
    super()
    this.render()
  }

  private render() {
    this.innerHTML = `
      <div class="bg-primary text-body-light dark:text-body-dark flex aspect-square w-1/8 items-center justify-center rounded-full text-center text-xs">
        <span>Today</span>
      </div>
    `
  }
}

customElements.define("health-today", HealthToday)
