import { HealthWeek } from "./HealthWeek"
import type { Day } from "./day"

type Slot = Day | "today" | "noData" | null

export interface MonthData {
	month: string
	comment: string
	days: Day[]
	year: number
	monthIndex: number // 0-11
}

/**
 * Displays a month of health data with weekly breakdowns.
 */
export class HealthMonth extends HTMLElement {
	private month = ""
	private comment = ""
	private days: Day[] = []
	private year = 0
	private monthIndex = 0

	setData({ month, comment, days, year, monthIndex }: MonthData) {
		this.month = month
		this.comment = comment
		this.days = days
		this.year = year
		this.monthIndex = monthIndex
		this.render()
		return this
	}

	private render() {
		// Use the provided year and month from browser date calculation
		const today = new Date()
		const firstDayOfMonth = new Date(this.year, this.monthIndex, 1)
		const monthYear = { year: this.year, month: this.monthIndex }

		// 1. Build a lookup map keyed as YYYY-MM-DD (local time)
		const key = (d: Date) => {
			const y = d.getFullYear()
			const m = (d.getMonth() + 1).toString().padStart(2, "0")
			const day = d.getDate().toString().padStart(2, "0")
			return `${y}-${m}-${day}`
		}
		const dataMap = new Map(this.days.map((d) => [key(d.date), d]))

		// 2. Calendar boundaries & helpers
		const daysInMonth = new Date(
			monthYear.year,
			monthYear.month + 1,
			0,
		).getDate()
		const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7 // week offset (0 = Mon … 6 = Sun)

		const isSameDay = (a: Date, b: Date) =>
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()

		const isCurrentMonth =
			today.getFullYear() === monthYear.year &&
			today.getMonth() === monthYear.month

		// 3. Build calendar "slots" (null / today / noData / Day)
		const slots: Slot[] = []
		slots.push(...Array(firstWeekday).fill(null)) // blanks before the 1st

		for (let day = 1; day <= daysInMonth; day++) {
			const date = new Date(monthYear.year, monthYear.month, day)
			if (date > today) {
				slots.push(null) // future → blank
				continue
			}
			if (isCurrentMonth && isSameDay(date, today)) {
				slots.push("today")
				continue
			}
			const d = dataMap.get(key(date))
			slots.push(d ?? "noData")
		}

		// 4. Post-processing: pad to full weeks, then chunk
		// pad end of last week
		while (slots.length % 7 !== 0) slots.push(null)

		// chunk by weeks
		const weeks: Slot[][] = []
		for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7))

		// remove empty weeks at the end
		while (weeks.length && weeks[weeks.length - 1].every((s) => s === null))
			weeks.pop()

		// 5. Render: month header + weekday labels + weekly rows
		const article = document.createElement("article")
		const h3 = document.createElement("h3")
		h3.textContent = this.month
		const p = document.createElement("p")
		p.textContent = this.comment || "No comment yet."
		article.append(h3, p)

		const wrapper = document.createElement("div")
		wrapper.className = "overflow-x-auto"

		const grid = document.createElement("div")
		grid.className = "mb-1 grid min-w-lg grid-cols-8 gap-2.5 text-center"
		grid.innerHTML =
			"<span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span><span>Avg</span>"
		wrapper.appendChild(grid)

		weeks.forEach((w) => wrapper.appendChild(new HealthWeek().setDays(w)))
		article.appendChild(wrapper)

		this.replaceChildren(article)
	}
}

customElements.define("health-month", HealthMonth)
