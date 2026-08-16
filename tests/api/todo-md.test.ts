import { describe, expect, it } from "vitest"
import {
	buildTodoItems,
	type TodoItem,
	type TodoList,
} from "../../src/catalogue/todo"
import {
	buildFacetUrl,
	buildTodoQueryString,
	parseTodoQuery,
	renderApiDoc,
	renderFilterSummary,
	renderTodo,
	renderTodoItemLine,
	type TodoListSummary,
	type TodoView,
} from "../../src/pages/catalogue/todo.md"

const urlOf = (qs: string) =>
	new URL(`http://localhost:4321/catalogue/todo.md${qs}`)

const SITE = "https://example.com"
const LIST_IDS = ["ghibli", "zelda"]

const summaries: TodoListSummary[] = [
	{
		id: "ghibli",
		title: "Studio Ghibli",
		source: "TMDB_MOVIE",
		inactive: true,
		progress: { total: 30, doneCount: 12, percent: 40 },
	},
	{
		id: "zelda",
		title: "Marathon Zelda",
		source: "IGDB",
		inactive: false,
		progress: { total: 26, doneCount: 16, percent: 62 },
	},
]

const doneItem: TodoItem = {
	id: 539,
	name: "Psycho",
	year: 1960,
	poster: null,
	done: true,
	emoji: "😀",
	href: "/catalogue?query=Psycho%20(1960)&source=TMDB_MOVIE",
	meta: "Horror, Thriller",
}

const todoItem: TodoItem = {
	id: 424,
	name: "Schindler's List",
	year: 1993,
	poster: null,
	done: false,
	emoji: null,
	href: "https://www.themoviedb.org/movie/424",
}

describe("parseTodoQuery", () => {
	it("returns defaults for an empty query string", () => {
		const parsed = parseTodoQuery(urlOf(""), LIST_IDS)
		expect(parsed.limit).toBe(20)
		expect(parsed.offset).toBe(0)
		expect(parsed.filters).toEqual({
			list: undefined,
			query: undefined,
			status: "all",
			sort: "year-asc",
		})
	})

	it("parses every supported parameter", () => {
		const parsed = parseTodoQuery(
			urlOf(
				"?list=zelda&query=link&status=todo&sort=year-desc&limit=50&offset=20",
			),
			LIST_IDS,
		)
		expect(parsed.limit).toBe(50)
		expect(parsed.offset).toBe(20)
		expect(parsed.filters).toEqual({
			list: "zelda",
			query: "link",
			status: "todo",
			sort: "year-desc",
		})
	})

	it("drops unknown list ids", () => {
		expect(
			parseTodoQuery(urlOf("?list=bogus"), LIST_IDS).filters.list,
		).toBeUndefined()
	})

	it("falls back to defaults for invalid status and sort", () => {
		const parsed = parseTodoQuery(urlOf("?status=banana&sort=title"), LIST_IDS)
		expect(parsed.filters.status).toBe("all")
		expect(parsed.filters.sort).toBe("year-asc")
	})

	it("clamps limit to 1..100", () => {
		expect(parseTodoQuery(urlOf("?limit=0"), LIST_IDS).limit).toBe(1)
		expect(parseTodoQuery(urlOf("?limit=500"), LIST_IDS).limit).toBe(100)
		expect(parseTodoQuery(urlOf("?limit=abc"), LIST_IDS).limit).toBe(20)
	})

	it("ignores negative or non-numeric offsets", () => {
		expect(parseTodoQuery(urlOf("?offset=-5"), LIST_IDS).offset).toBe(0)
		expect(parseTodoQuery(urlOf("?offset=abc"), LIST_IDS).offset).toBe(0)
	})
})

describe("buildTodoQueryString", () => {
	it("returns an empty string when all values are defaults", () => {
		expect(
			buildTodoQueryString({ status: "all", sort: "year-asc" }, 20, 0),
		).toBe("")
	})

	it("omits default status, sort, limit, and zero offset", () => {
		expect(
			buildTodoQueryString(
				{ list: "zelda", status: "all", sort: "year-asc" },
				20,
				0,
			),
		).toBe("?list=zelda")
	})

	it("includes every non-default value in a fixed order", () => {
		expect(
			buildTodoQueryString(
				{ list: "zelda", query: "link", status: "todo", sort: "year-desc" },
				50,
				20,
			),
		).toBe(
			"?list=zelda&query=link&status=todo&sort=year-desc&limit=50&offset=20",
		)
	})

	it("round-trips through parseTodoQuery", () => {
		const qs = buildTodoQueryString(
			{ list: "zelda", query: "link", status: "done", sort: "year-desc" },
			50,
			20,
		)
		const parsed = parseTodoQuery(urlOf(qs), LIST_IDS)
		expect(parsed.filters).toEqual({
			list: "zelda",
			query: "link",
			status: "done",
			sort: "year-desc",
		})
		expect(parsed.limit).toBe(50)
		expect(parsed.offset).toBe(20)
	})

	it("appends help=0 last when the API section is hidden", () => {
		expect(
			buildTodoQueryString({ status: "all", sort: "year-asc" }, 20, 10, false),
		).toBe("?offset=10&help=0")
	})
})

describe("buildFacetUrl", () => {
	it("resets offset and raises a default page size to the max", () => {
		expect(buildFacetUrl(SITE, {}, { list: "zelda" }, 20, true)).toBe(
			"https://example.com/catalogue/todo.md?list=zelda&limit=100",
		)
	})

	it("keeps an explicitly chosen limit", () => {
		expect(buildFacetUrl(SITE, {}, { list: "zelda" }, 10, true)).toBe(
			"https://example.com/catalogue/todo.md?list=zelda&limit=10",
		)
	})

	it("merges the patch over current filters, dropping undefined values", () => {
		expect(
			buildFacetUrl(
				SITE,
				{ list: "zelda", status: "todo" },
				{ list: undefined },
				20,
				true,
			),
		).toBe("https://example.com/catalogue/todo.md?status=todo&limit=100")
	})

	it("carries the hidden-help state", () => {
		expect(buildFacetUrl(SITE, {}, { status: "done" }, 20, false)).toBe(
			"https://example.com/catalogue/todo.md?status=done&limit=100&help=0",
		)
	})

	it("encodes spaces and accents so the link round-trips through parse", () => {
		const spaced = buildFacetUrl(
			SITE,
			{ list: "zelda" },
			{ query: "ocarina of time" },
			20,
			true,
		)
		expect(spaced).toBe(
			"https://example.com/catalogue/todo.md?list=zelda&query=ocarina+of+time&limit=100",
		)
		expect(parseTodoQuery(new URL(spaced), LIST_IDS).filters.query).toBe(
			"ocarina of time",
		)
		const accented = buildFacetUrl(
			SITE,
			{},
			{ query: "château ambulant" },
			20,
			true,
		)
		expect(accented).toBe(
			"https://example.com/catalogue/todo.md?query=ch%C3%A2teau+ambulant&limit=100",
		)
		expect(parseTodoQuery(new URL(accented), LIST_IDS).filters.query).toBe(
			"château ambulant",
		)
	})
})

describe("renderTodoItemLine", () => {
	it("deep-links a done item into the catalogue markdown twin", () => {
		expect(renderTodoItemLine(doneItem, SITE)).toBe(
			"- Psycho (1960) — done 😀: https://example.com/catalogue.md?query=Psycho%20(1960)&source=TMDB_MOVIE",
		)
	})

	it("keeps the external page for an item still to do", () => {
		expect(renderTodoItemLine(todoItem, SITE)).toBe(
			"- Schindler's List (1993): https://www.themoviedb.org/movie/424",
		)
	})

	it("reads a negative year back as BCE", () => {
		const item: TodoItem = {
			...todoItem,
			name: "Gorgias",
			year: -385,
			href: "https://openlibrary.org/books/OL1M",
		}
		expect(renderTodoItemLine(item, SITE)).toBe(
			"- Gorgias (385 BCE): https://openlibrary.org/books/OL1M",
		)
	})

	it("omits the emoji when the rating has none", () => {
		const item: TodoItem = { ...doneItem, emoji: null }
		expect(renderTodoItemLine(item, SITE)).toBe(
			"- Psycho (1960) — done: https://example.com/catalogue.md?query=Psycho%20(1960)&source=TMDB_MOVIE",
		)
	})
})

describe("buildTodoItems → renderTodoItemLine coupling", () => {
	// The consumer rewrites a done href only when it matches the producer's
	// exact "/catalogue?" shape; a drift on either side (e.g. "/catalogue/?query=")
	// would silently print a relative URL in the twin.
	it("prints an absolute catalogue.md URL for a done item built by the real producer", () => {
		const list: TodoList = {
			id: "hitchcock",
			title: "Hitchcock",
			description: "Every Hitchcock feature film.",
			source: "TMDB_MOVIE",
			entries: [
				{
					id: 539,
					name: "Psycho",
					year: 1960,
					poster: null,
					link: "https://www.themoviedb.org/movie/539",
				},
			],
		}
		const [item] = buildTodoItems(
			list,
			new Map([["539", "😀"]]),
			new Map([["539", "Psycho (1960)"]]),
		)
		expect(item.done).toBe(true)
		expect(renderTodoItemLine(item, SITE)).toBe(
			"- Psycho (1960) — done 😀: https://example.com/catalogue.md?query=Psycho%20(1960)&source=TMDB_MOVIE",
		)
	})
})

describe("renderApiDoc", () => {
	const doc = (
		filters: Parameters<typeof renderApiDoc>[2],
		progress: Parameters<typeof renderApiDoc>[5] = null,
		limit = 20,
		offset = 0,
	) => renderApiDoc(summaries, SITE, filters, limit, offset, progress)

	it("shows only the free-form parameters until a list is selected", () => {
		const out = doc({ status: "all", sort: "year-asc" })
		expect(out).toContain("- query=<text>")
		expect(out).toContain("- help=<0|1>")
		expect(out).not.toContain("\nlist:")
		expect(out).not.toContain("\nstatus:")
		expect(out).not.toContain("\nsort:")
	})

	it("prints list, status, and sort facet links once a list is selected", () => {
		const lines = doc(
			{ list: "ghibli", status: "all", sort: "year-asc" },
			summaries[0].progress,
		).split("\n")
		expect(lines).toContain(
			"- Studio Ghibli: active — remove: https://example.com/catalogue/todo.md?limit=100",
		)
		expect(lines).toContain(
			"- Marathon Zelda: https://example.com/catalogue/todo.md?list=zelda&limit=100",
		)
		expect(lines).toContain("- all (30): active")
		expect(lines).toContain(
			"- done (12): https://example.com/catalogue/todo.md?list=ghibli&status=done&limit=100",
		)
		expect(lines).toContain(
			"- todo (18): https://example.com/catalogue/todo.md?list=ghibli&status=todo&limit=100",
		)
		expect(lines).toContain("- year-asc (oldest first): active")
		expect(lines).toContain(
			"- year-desc (newest first): https://example.com/catalogue/todo.md?list=ghibli&sort=year-desc&limit=100",
		)
	})

	it("facet links carry the other active filters but never offset", () => {
		const lines = doc(
			{ list: "ghibli", query: "mono", status: "all", sort: "year-asc" },
			summaries[0].progress,
			20,
			40,
		).split("\n")
		expect(lines).toContain(
			"- done (12): https://example.com/catalogue/todo.md?list=ghibli&query=mono&status=done&limit=100",
		)
	})

	it("keeps the current page in the hide link", () => {
		const lines = doc({ status: "all", sort: "year-asc" }, null, 20, 40).split(
			"\n",
		)
		expect(lines).toContain(
			"Hide this API section: https://example.com/catalogue/todo.md?offset=40&help=0",
		)
	})
})

describe("renderFilterSummary", () => {
	it("returns No filters. when everything is default", () => {
		expect(
			renderFilterSummary({ status: "all", sort: "year-asc" }, SITE, 20, true),
		).toBe("No filters.")
	})

	it("appends a removal link to every active part", () => {
		expect(
			renderFilterSummary(
				{ list: "ghibli", status: "todo", sort: "year-asc" },
				SITE,
				20,
				true,
			),
		).toBe(
			"Filters: list=ghibli (remove: https://example.com/catalogue/todo.md?status=todo&limit=100 ), status=todo (remove: https://example.com/catalogue/todo.md?list=ghibli&limit=100 ).",
		)
	})

	it("propagates hidden help into removal links", () => {
		expect(
			renderFilterSummary(
				{ status: "all", sort: "year-desc" },
				SITE,
				20,
				false,
			),
		).toBe(
			"Filters: sort=year-desc (remove: https://example.com/catalogue/todo.md?limit=100&help=0 ).",
		)
	})
})

describe("renderTodo", () => {
	const indexView: TodoView = {
		site: SITE,
		filters: { status: "all", sort: "year-asc" },
		limit: 20,
		offset: 0,
		showHelp: true,
		lists: summaries,
		detail: null,
	}

	const detailView: TodoView = {
		site: SITE,
		filters: { list: "ghibli", status: "todo", sort: "year-asc" },
		limit: 20,
		offset: 20,
		showHelp: false,
		lists: summaries,
		detail: {
			list: summaries[0],
			description: "Every Studio Ghibli feature film.",
			url: "https://en.wikipedia.org/wiki/List_of_Studio_Ghibli_works",
			statsLine: "On average loved 😍, and mostly felt moved, comforted.",
			matched: 30,
			items: [todoItem],
		},
	}

	it("indexes every list with nature, activity, progress, and its URL", () => {
		const lines = renderTodo(indexView).split("\n")
		expect(lines).toContain(
			"- Studio Ghibli (movies, inactive): 12/30 done (40%) — https://example.com/catalogue/todo.md?list=ghibli&limit=100",
		)
		expect(lines).toContain(
			"- Marathon Zelda (video games): 16/26 done (62%) — https://example.com/catalogue/todo.md?list=zelda&limit=100",
		)
		expect(renderTodo(indexView)).toContain("2 lists, 56 items, 28 done.")
	})

	it("keeps index list links working while help is hidden", () => {
		const out = renderTodo({ ...indexView, showHelp: false })
		expect(out).toContain(
			"API guide hidden. Show filter, sort, and pagination options: https://example.com/catalogue/todo.md",
		)
		expect(out).toContain(
			"- Marathon Zelda (video games): 16/26 done (62%) — https://example.com/catalogue/todo.md?list=zelda&limit=100&help=0",
		)
		expect(out).not.toContain("Free-form parameters")
	})

	it("carries a stray filter into every index list link and summarizes it above them", () => {
		const lines = renderTodo({
			...indexView,
			filters: { status: "todo", sort: "year-asc" },
		}).split("\n")
		const summary =
			"Filters: status=todo (remove: https://example.com/catalogue/todo.md?limit=100 )."
		const ghibli =
			"- Studio Ghibli (movies, inactive): 12/30 done (40%) — https://example.com/catalogue/todo.md?list=ghibli&status=todo&limit=100"
		const zelda =
			"- Marathon Zelda (video games): 16/26 done (62%) — https://example.com/catalogue/todo.md?list=zelda&status=todo&limit=100"
		expect(lines).toContain(summary)
		expect(lines).toContain(ghibli)
		expect(lines).toContain(zelda)
		expect(lines.indexOf(summary)).toBeLessThan(lines.indexOf(ghibli))
	})

	it("renders the detail header with description, source, progress, and stats", () => {
		const out = renderTodo(detailView)
		expect(out).toContain("## Studio Ghibli")
		expect(out).toContain("Every Studio Ghibli feature film.")
		expect(out).toContain(
			"Source list: https://en.wikipedia.org/wiki/List_of_Studio_Ghibli_works",
		)
		expect(out).toContain(
			"Progress: 12/30 done (40%). On average loved 😍, and mostly felt moved, comforted.",
		)
	})

	it("joins the filter summary and range on one line", () => {
		const lines = renderTodo(detailView).split("\n")
		expect(lines).toContain(
			"Filters: list=ghibli (remove: https://example.com/catalogue/todo.md?status=todo&limit=100&help=0 ), status=todo (remove: https://example.com/catalogue/todo.md?list=ghibli&limit=100&help=0 ). Showing 21–21 of 30.",
		)
	})

	it("propagates every active param plus help through pagination", () => {
		const lines = renderTodo(detailView).split("\n")
		expect(lines).toContain(
			"Previous page: https://example.com/catalogue/todo.md?list=ghibli&status=todo&help=0",
		)
		expect(lines).toContain(
			"Max page size: https://example.com/catalogue/todo.md?list=ghibli&status=todo&limit=100&help=0",
		)
		const firstPage = renderTodo({ ...detailView, offset: 0 }).split("\n")
		expect(firstPage).toContain(
			"Next page: https://example.com/catalogue/todo.md?list=ghibli&status=todo&offset=20&help=0",
		)
	})

	it("wires the selected list's counts into the expanded facet links", () => {
		const lines = renderTodo({ ...detailView, showHelp: true }).split("\n")
		expect(lines).toContain(
			"- all (30): https://example.com/catalogue/todo.md?list=ghibli&limit=100",
		)
		expect(lines).toContain("- todo (18): active")
	})

	it("summary removal URLs survive naive extraction with page size and help state intact", () => {
		const line = renderTodo(detailView)
			.split("\n")
			.find((l) => l.startsWith("Filters:"))
		expect(line).toBeDefined()
		const urls = line?.match(/https?:\/\/\S+/g) ?? []
		expect(urls.length).toBeGreaterThan(0)
		for (const url of urls) {
			expect(url).not.toMatch(/[).,]$/)
			expect(parseTodoQuery(new URL(url), LIST_IDS).limit).toBe(100)
			expect(new URL(url).searchParams.get("help")).toBe("0")
		}
	})

	it("renders the empty state", () => {
		const out = renderTodo({
			...detailView,
			offset: 0,
			detail: { ...detailView.detail!, matched: 0, items: [] },
		})
		expect(out).toContain("Showing 0 of 0.")
		expect(out).toContain("No items match these filters.")
	})
})
