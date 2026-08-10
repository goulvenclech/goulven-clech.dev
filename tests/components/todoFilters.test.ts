import { describe, it, expect } from "vitest"
import {
	buildTodoParams,
	defaultTodoListId,
	filtersFromUrl,
	resolveTodoState,
	DEFAULT_LIST_ID,
} from "$components/catalogue/todoFilters"

/** A page that doesn't carry the default list, so it degrades to the first id. */
const listIds = ["007-films", "pokemon-marathon", "zelda-marathon"]
const withDefault = [...listIds, DEFAULT_LIST_ID]

describe("buildTodoParams", () => {
	it("omits the default list, sort, and status", () => {
		const params = buildTodoParams(
			{
				list: DEFAULT_LIST_ID,
				query: "",
				sort: "year-asc",
				status: "all",
			},
			withDefault,
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
			withDefault,
		)
		expect(params.get("list")).toBe("zelda-marathon")
		expect(params.get("query")).toBe("ocarina")
		expect(params.get("sort")).toBe("year-desc")
		expect(params.get("status")).toBe("done")
	})

	// The URL only omits what resolution puts back, so both ends have to agree
	// on which list "no list param" means.
	describe.each([
		["a page carrying the default", withDefault],
		["a page without it", listIds],
	])("round-trips every list of %s", (_, ids) => {
		it.each(ids)("%s survives the URL", (list) => {
			const params = buildTodoParams(
				{ list, query: "", sort: "year-asc", status: "all" },
				ids,
			)
			expect(resolveTodoState(params, ids).list).toBe(list)
		})
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
	it("defaults everything for a bare URL, using the first list when the page lacks the default", () => {
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

	it("falls back to the first list and to sane values when the page lacks the default", () => {
		expect(
			resolveTodoState(
				new URLSearchParams("list=nope&sort=garbage&status=maybe"),
				listIds,
			),
		).toMatchObject({ list: "007-films", sort: "year-asc", status: "all" })
	})

	it("lands a bare URL on the default list rather than the first", () => {
		expect(
			resolveTodoState(new URLSearchParams(""), withDefault),
		).toMatchObject({ list: DEFAULT_LIST_ID })
	})

	it("still honours an explicit list over the default", () => {
		expect(
			resolveTodoState(new URLSearchParams("list=007-films"), withDefault),
		).toMatchObject({ list: "007-films" })
	})

	// Lists get renamed, so old links must land somewhere rather than empty.
	it("sends a stale list id to the default list", () => {
		expect(
			resolveTodoState(new URLSearchParams("list=gone-pile"), withDefault),
		).toMatchObject({ list: DEFAULT_LIST_ID })
	})
})

describe("defaultTodoListId", () => {
	it("picks the default list when the page carries it", () => {
		expect(defaultTodoListId(withDefault)).toBe(DEFAULT_LIST_ID)
	})

	it("degrades to the first list when the default is missing", () => {
		expect(defaultTodoListId(listIds)).toBe("007-films")
	})

	it("returns an empty id when there are no lists at all", () => {
		expect(defaultTodoListId([])).toBe("")
	})
})
