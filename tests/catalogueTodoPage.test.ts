// @vitest-environment node
import { describe, it, expect, vi } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import { DEFAULT_LIST_ID } from "$components/catalogue/todoFilters"

// Deliberately not the alphabetically-first list, so a regression to "first
// list" is visible.
const { LISTS } = vi.hoisted(() => ({
	LISTS: [
		{
			id: "aaa-other-pile",
			title: "AAA other pile",
			description: "The list that sorts first.",
			source: "OPENLIBRARY",
			entries: [
				{
					id: "OL1M",
					name: "First book",
					year: 2000,
					poster: null,
					link: "https://openlibrary.org/books/OL1M",
				},
			],
		},
		{
			id: "movies-everyone-should-watch",
			title: "ZZZ default pile",
			description: "The list a bare URL should land on.",
			source: "TMDB_MOVIE",
			url: "https://example.com/list",
			entries: [
				{
					id: 1,
					name: "A film",
					year: 1999,
					poster: null,
					link: "https://example.com/1",
				},
				{
					id: 2,
					name: "Another film",
					year: 2001,
					poster: null,
					link: "https://example.com/2",
				},
			],
		},
	],
}))

vi.mock("$src/db", () => ({ getClient: () => ({}) }))
vi.mock("$src/catalogue/todoData", () => ({
	todoLists: LISTS,
	loadTodoReviews: async () => ({
		doneBySource: new Map(),
		reviewsBySource: new Map(),
		namesBySource: new Map(),
		postersBySource: new Map(),
		emotionsById: new Map(),
	}),
}))

const render = async () => {
	const { default: TodoPage } =
		await import("../src/pages/catalogue/todo.astro")
	const container = await AstroContainer.create()
	return container.renderToString(TodoPage, {})
}

describe("catalogue to-do page", () => {
	it("marks the default list selected, not the first one", async () => {
		const html = await render()
		expect(html).toMatch(
			/<option value="1"[^>]*selected[^>]*>\s*ZZZ default pile/,
		)
		expect(html).not.toMatch(/<option value="0"[^>]*selected/)
	})

	it("server-renders the default list's own description and progress", async () => {
		const html = await render()
		// Every list is serialised into the page, so pin the rendered element.
		expect(html).toContain(
			'id="list-description">The list a bare URL should land on.<',
		)
		// Its two entries, not the other list's one.
		expect(html).toContain('id="todo-total">2<')
	})

	it("still lists every list, alphabetically, for browsing", async () => {
		const html = await render()
		expect(html.indexOf("AAA other pile")).toBeLessThan(
			html.indexOf("ZZZ default pile"),
		)
	})

	it("keeps the default id in step with the page's own constant", () => {
		expect(LISTS.map((list) => list.id)).toContain(DEFAULT_LIST_ID)
	})
})
