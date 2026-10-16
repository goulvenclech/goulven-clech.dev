import { afterEach, describe, expect, it, vi } from "vitest"
import { onDarkModeChange } from "../src/darkMode"

const root = document.documentElement

function mutationsDelivered(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve))
}

describe("onDarkModeChange", () => {
	let stop = () => {}

	afterEach(() => {
		stop()
		root.removeAttribute("class")
		root.removeAttribute("data-theme")
	})

	it("reports each switch between light and dark", async () => {
		const onChange = vi.fn()
		stop = onDarkModeChange(onChange)

		root.classList.add("dark")
		await mutationsDelivered()
		root.classList.remove("dark")
		await mutationsDelivered()

		expect(onChange).toHaveBeenCalledTimes(2)
	})

	it("ignores root changes that keep the theme", async () => {
		root.classList.add("dark")
		const onChange = vi.fn()
		stop = onDarkModeChange(onChange)

		root.classList.add("dark", "other")
		root.setAttribute("data-theme", "dark")
		await mutationsDelivered()

		expect(onChange).not.toHaveBeenCalled()
	})
})
