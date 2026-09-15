import { describe, it, expect } from "vitest"
import { DEFAULT_LIST_ID } from "$components/catalogue/todoFilters"
import { HIDDEN_LIST_IDS, todoLists } from "../src/catalogue/todoData"

describe("todoLists", () => {
	it("carries the list a bare /catalogue/todo lands on", () => {
		expect(todoLists.map((list) => list.id)).toContain(DEFAULT_LIST_ID)
	})

	it("keeps browse order alphabetical by title", () => {
		const titles = todoLists.map((list) => list.title)
		expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)))
	})

	it("leaves hidden lists off the site while their data stays in the repo", () => {
		const ids = todoLists.map((list) => list.id)
		const listFiles = Object.keys(import.meta.glob("/src/data/lists/*.json"))
		for (const id of HIDDEN_LIST_IDS) {
			expect(ids).not.toContain(id)
			expect(listFiles).toContain(`/src/data/lists/${id}.json`)
		}
	})
})
