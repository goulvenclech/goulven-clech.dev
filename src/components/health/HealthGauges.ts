import { renderHealthGauge } from "./HealthGauge"

export interface GaugesData {
	steps: number | null
	sleep: number | null
	energy: number | null
}

/**
 * Displays health gauges for steps, sleep, and energy.
 */
export class HealthGauges extends HTMLElement {
	private steps: number | null = null
	private sleep: number | null = null
	private energy: number | null = null

	constructor() {
		super()
		this.classList.add("contents")
	}

	setData({ steps, sleep, energy }: GaugesData) {
		this.steps = steps
		this.sleep = sleep
		this.energy = energy
		this.render()
		return this
	}

	private render() {
		this.innerHTML = `
      <div class="flex aspect-square w-1/8 items-center justify-center">
        <svg viewBox="0 0 120 120" class="h-full w-full">
          ${renderHealthGauge({ radius: 54, value: this.steps ?? 0, max: 9000, strokeClass: "stroke-primary" })}
          ${renderHealthGauge({ radius: 40, value: this.sleep ?? 0, max: 7, strokeClass: "stroke-success" })}
          ${renderHealthGauge({ radius: 26, value: this.energy ?? 0, max: 100, strokeClass: "stroke-info", dimThreshold: 75 })}
          ${this.energy !== null ? `<text x="60" y="60" text-anchor="middle" dominant-baseline="middle" class="text-lg font-medium select-none dark:text-font-dark text-font-light fill-current">${this.energy.toLocaleString()}</text>` : ""}
        </svg>
      </div>
    `
	}
}

customElements.define("health-gauges", HealthGauges)
