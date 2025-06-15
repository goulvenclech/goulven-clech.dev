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
    // 1. Filter out the days that actually contain data
    const daysWithData = this.days.filter(
      (day): day is Day => typeof day === "object" && day !== null
    )

    // 2. Compute running totals for each metric, skipping null values
    const stepValues   = daysWithData.map(d => d.steps ).filter((v): v is number => v != null)
    const sleepValues  = daysWithData.map(d => d.sleep ).filter((v): v is number => v != null)
    const energyValues = daysWithData.map(d => d.energy).filter((v): v is number => v != null)

    const totalSteps   = stepValues.reduce((sum, v) => sum + v, 0)
    const totalSleep   = sleepValues.reduce((sum, v) => sum + v, 0)
    const totalEnergy  = energyValues.reduce((sum, v) => sum + v, 0)

    // 3. Derive averages
    const averageSteps  = stepValues.length   ? Math.round(totalSteps  / stepValues.length)  : 0
    const averageSleep  = sleepValues.length  ? +(totalSleep  / sleepValues.length).toFixed(1) : 0
    const averageEnergy = energyValues.length ? Math.round(totalEnergy / energyValues.length) : 0

    // 4. Check goals
    const isStepsGoalReached  = averageSteps  >= 7500
    const isSleepGoalReached  = averageSleep  >= 7
    const isEnergyGoalReached = averageEnergy >= 75

    // 5. Helper to shorten big numbers
    const formatThousands = (value: number) =>
      value >= 1000
        ? (value / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k"
        : value.toString()

    // 6. Build the week container
    const weekContainer = document.createElement("div")
    weekContainer.className = "mb-2.5 flex min-w-lg gap-2.5"

    for (const slot of this.days) {
      let element: HTMLElement
      switch (slot) {
        case null:
          element = document.createElement("div")
          element.className = "flex aspect-square w-1/8"
          break
        case "today":
          element = new HealthToday()
          break
        case "noData":
          element = new HealthNoData()
          break
        default:
          element = new HealthGauges().setData({
            steps:  slot.steps,
            sleep:  slot.sleep,
            energy: slot.energy,
          })
      }
      weekContainer.appendChild(element)
    }

    // 7. Averages / stats element
    const averagesElement = document.createElement("div")
    averagesElement.className = "flex aspect-square w-1/8 flex-col items-center justify-center text-xs leading-tight sm:text-sm"

    const stepsSpan = document.createElement("span")
    if (stepValues.length) {
      if (isStepsGoalReached) stepsSpan.classList.add("text-primary")
      stepsSpan.innerText = `${formatThousands(averageSteps)}\u00A0steps`
    }

    const sleepSpan = document.createElement("span")
    if (sleepValues.length) {
      if (isSleepGoalReached) sleepSpan.classList.add("text-success")
      sleepSpan.innerText = `${averageSleep}\u00A0hours`
    }

    const energySpan = document.createElement("span")
    if (energyValues.length) {
      if (isEnergyGoalReached) energySpan.classList.add("text-info")
      energySpan.innerText = `${averageEnergy}\u00A0energy`
    }

    averagesElement.append(stepsSpan, sleepSpan, energySpan)
    weekContainer.appendChild(averagesElement)

    // 8. Inject into the DOM
    this.replaceChildren(weekContainer)
  }
}

customElements.define("health-week", HealthWeek)
