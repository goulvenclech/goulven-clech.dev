import { describe, it, expect } from "vitest"
import {
	buildTodoParams,
	filtersFromUrl,
	resolveTodoState,
} from "$components/catalogue/todoFilters"

const listIds = ["007-films", "pokemon-marathon", "zelda-marathon"]

const defaults = { list: "007-films" }

describe("buildTodoParams", () => {
	it("omits the default list, sort, and status", () => {
		const params = buildTodoParams(
			{ list: "007-films", query: "", sort: "year-asc", status: "all" },
			defaults,
		)
		expect(params.toString()).toBe("")
	})

	it("keeps a non-default list and filters", () => {
		const params = buildTodoParams(
			{
				list: "zelda-marathon",
				query: "ocarina",
				sort: "year-desc",
				status: "done",
			},
			defaults,
		)
		expect(params.get("list")).toBe("zelda-marathon")
		expect(params.get("query")).toBe("ocarina")
		expect(params.get("sort")).toBe("year-desc")
		expect(params.get("status")).toBe("done")
	})
})

describe("filtersFromUrl", () => {
	it("reads only the keys present in the URL", () => {
		const out = filtersFromUrl(
			new URLSearchParams("list=pokemon-marathon&status=todo"),
		)
		expect(out).toEqual({ list: "pokemon-marathon", status: "todo" })
	})

	it("returns an empty object for a bare URL", () => {
		expect(filtersFromUrl(new URLSearchParams(""))).toEqual({})
	})
})

describe("resolveTodoState", () => {
	it("defaults everything for a bare URL, using the first list", () => {
		expect(resolveTodoState(new URLSearchParams(""), listIds)).toEqual({
			list: "007-films",
			query: "",
			sort: "year-asc",
			status: "all",
		})
	})

	it("keeps valid params", () => {
		expect(
			resolveTodoState(
				new URLSearchParams(
					"list=zelda-marathon&query=zelda&sort=year-desc&status=done",
				),
				listIds,
			),
		).toEqual({
			list: "zelda-marathon",
			query: "zelda",
			sort: "year-desc",
			status: "done",
		})
	})

	it("falls back to defaults for an unknown list and out-of-range values", () => {
		expect(
			resolveTodoState(
				new URLSearchParams("list=nope&sort=garbage&status=maybe"),
				listIds,
			),
		).toMatchObject({ list: "007-films", sort: "year-asc", status: "all" })
	})
})
