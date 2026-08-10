import { describe, it, expect } from "vitest"
import { DEFAULT_LIST_ID } from "$components/catalogue/todoFilters"
import { todoLists } from "../src/catalogue/todoData"

describe("todoLists", () => {
	it("carries the list a bare /catalogue/todo lands on", () => {
		expect(todoLists.map((list) => list.id)).toContain(DEFAULT_LIST_ID)
	})

	it("keeps browse order alphabetical by title", () => {
		const titles = todoLists.map((list) => list.title)
		expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)))
	})
})
