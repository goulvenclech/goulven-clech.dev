/** Simple placeholder when there is no data. */
export class HealthNoData extends HTMLElement {
	constructor() {
		super()
		this.classList.add("contents")
		this.render()
	}

	private render() {
		this.innerHTML = `
      <div class="bg-alt-light dark:bg-alt-dark flex aspect-square w-1/8 items-center justify-center rounded-full text-center text-xs">
        <span>No data</span>
      </div>
    `
	}
}

customElements.define("health-no-data", HealthNoData)
