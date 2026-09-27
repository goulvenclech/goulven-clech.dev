import { describe, it, expect } from "vitest"
import { todoCard } from "$components/catalogue/todoCard"
import type { TodoItem } from "$src/catalogue/todo"

function item(overrides: Partial<TodoItem> = {}): TodoItem {
	return {
		id: 1,
		name: "What is a Complex System?",
		year: 2022,
		poster: null,
		done: false,
		emoji: null,
		href: "https://openlibrary.org/works/OL1W",
		...overrides,
	}
}

function unpairedNeutralColors(root: Element): string[] {
	return [root, ...root.querySelectorAll("*")].flatMap((element) =>
		[...element.classList].filter(
			(name) =>
				/^(bg|text|border)-(font|body|alt)-light$/.test(name) &&
				!element.classList.contains(`dark:${name.replace(/light$/, "dark")}`),
		),
	)
}

describe("todoCard", () => {
	it("labels an item without a poster with its title and year", () => {
		const card = todoCard(item())
		expect(card.querySelector("img")).toBeNull()
		expect(card.textContent).toBe("What is a Complex System? (2022)")
	})

	it("swaps a poster that fails to load for the same label", () => {
		const card = todoCard(item({ poster: "https://example.com/poster.jpg" }))
		card.querySelector("img")!.dispatchEvent(new Event("error"))
		expect(card.querySelector("img")).toBeNull()
		expect(card.textContent).toBe("What is a Complex System? (2022)")
	})

	it("pairs every light neutral colour with its dark counterpart", () => {
		expect(unpairedNeutralColors(todoCard(item()))).toEqual([])
		expect(
			unpairedNeutralColors(todoCard(item({ poster: "https://x/p.jpg" }))),
		).toEqual([])
	})

	it("lets a long label wrap inside the card", () => {
		const label = todoCard(item()).firstElementChild!
		expect(label.classList).toContain("whitespace-normal")
	})

	it("dims items still to do and opens them in a new tab", () => {
		const todo = todoCard(item({ done: false }))
		expect(todo.classList).toContain("opacity-60")
		expect(todo.target).toBe("_blank")

		const done = todoCard(item({ done: true }))
		expect(done.classList).not.toContain("opacity-60")
		expect(done.target).toBe("")
	})
})
