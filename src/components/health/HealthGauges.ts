import { renderHealthGauge } from "./HealthGauge"

export interface GaugesData {
  steps: number
  sleep: number
  energy: number
}

/**
 * Displays health gauges for steps, sleep, and energy.
 */
export class HealthGauges extends HTMLElement {
  private steps = 0
  private sleep = 0
  private energy = 0

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
          ${renderHealthGauge({ radius: 54, value: this.steps, max: 7500, strokeClass: "stroke-primary" })}
          ${renderHealthGauge({ radius: 40, value: this.sleep, max: 7, strokeClass: "stroke-success" })}
          ${renderHealthGauge({ radius: 26, value: this.energy, max: 100, strokeClass: "stroke-info", dimThreshold: 75 })}
          <text x="60" y="60" text-anchor="middle" dominant-baseline="middle" class="text-lg font-bold select-none">${this.energy}</text>
        </svg>
      </div>
    `
  }
}

customElements.define("health-gauges", HealthGauges)
