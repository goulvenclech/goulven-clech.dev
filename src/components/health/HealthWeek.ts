import { HealthGauges } from "./HealthGauges"
import { HealthNoData } from "./HealthNoData"
import { HealthToday } from "./HealthToday"
import type { Day } from "./day"

type Slot = Day | "today" | "noData" | null

/**
 * Displays a week of health data with gauges for each day.
 */
export class HealthWeek extends HTMLElement {
  private days: Slot[] = []

  setDays(days: Slot[]) {
    this.days = days
    this.render()
    return this
  }

  private render() {
    const filled = this.days.filter((d): d is Day => typeof d === "object" && d !== null)

    const avgSteps = filled.length ? Math.round(filled.reduce((s, d) => s + d.steps, 0) / filled.length) : 0
    const avgSleep = filled.length ? +(filled.reduce((s, d) => s + d.sleep, 0) / filled.length).toFixed(1) : 0
    const avgEnergy = filled.length ? Math.round(filled.reduce((s, d) => s + d.energy, 0) / filled.length) : 0

    const stepsOK = avgSteps >= 7500
    const sleepOK = avgSleep >= 7
    const energyOK = avgEnergy >= 75

    const formatK = (n: number) =>
      n >= 1000
        ? (n / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k"
        : n.toString()

    const container = document.createElement("div")
    container.className = "mb-2.5 flex min-w-lg gap-2.5"

    for (const d of this.days) {
      let el: HTMLElement
      switch (d) {
        case null:
          el = document.createElement("div")
          el.className = "flex aspect-square w-1/8"
          break
        case "today":
          el = new HealthToday()
          break
        case "noData":
          el = new HealthNoData()
          break
        default:
          el = new HealthGauges().setData({ steps: d.steps, sleep: d.sleep, energy: d.energy })
      }
      container.appendChild(el)
    }

    const stats = document.createElement("div")
    stats.className = "flex aspect-square w-1/8 flex-col items-center justify-center text-xs leading-tight sm:text-sm"

    const spanSteps = document.createElement("span")
    if (stepsOK) spanSteps.classList.add("text-primary")
    spanSteps.innerText = `${formatK(avgSteps)}\u00A0steps`

    const spanSleep = document.createElement("span")
    if (sleepOK) spanSleep.classList.add("text-success")
    spanSleep.innerText = `${avgSleep}\u00A0hours`

    const spanEnergy = document.createElement("span")
    if (energyOK) spanEnergy.classList.add("text-info")
    spanEnergy.innerText = `${avgEnergy}\u00A0energy`

    stats.append(spanSteps, spanSleep, spanEnergy)
    container.appendChild(stats)

    this.replaceChildren(container)
  }
}

customElements.define("health-week", HealthWeek)
