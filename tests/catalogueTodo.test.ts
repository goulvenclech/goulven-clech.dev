import { describe, it, expect } from "vitest"
import {
	buildTodoItems,
	computeTodoProgress,
	filterTodoItems,
	sortTodoItems,
	type TodoItem,
	type TodoList,
} from "../src/catalogueTodo"

const list = (source: string, entries: TodoList["entries"]): TodoList => ({
	id: "l",
	title: "L",
	description: "",
	source,
	entries,
})

const entry = (id: number, name: string, year = 2000) => ({
	id,
	name,
	year,
	poster: `poster-${id}.jpg`,
	link: `https://example.com/${id}`,
})

const item = (over: Partial<TodoItem>): TodoItem => ({
	id: 1,
	name: "A",
	year: 2000,
	poster: null,
	done: false,
	emoji: null,
	href: "",
	...over,
})

describe("buildTodoItems", () => {
	it("marks entries done from the review map and links them to the catalogue", () => {
		const movies = list("TMDB_MOVIE", [entry(1, "Seen"), entry(2, "Unseen")])
		const [done, todo] = buildTodoItems(movies, new Map([[1, "😍"]]))

		expect(done).toMatchObject({ done: true, emoji: "😍" })
		expect(done.href).toBe("/catalogue?query=Seen&source=TMDB_MOVIE")
		expect(todo).toMatchObject({ done: false, emoji: null })
		expect(todo.href).toBe("https://example.com/2")
	})

	it("uses the list's own source in the catalogue deep-link", () => {
		const games = list("IGDB", [entry(1029, "Ocarina of Time")])
		const [game] = buildTodoItems(games, new Map([[1029, "⭐"]]))
		expect(game.href).toBe("/catalogue?query=Ocarina%20of%20Time&source=IGDB")
	})
})

describe("computeTodoProgress", () => {
	it("counts done items and rounds the percentage", () => {
		const items = [
			item({ done: true }),
			item({ done: false }),
			item({ done: false }),
		]
		expect(computeTodoProgress(items)).toEqual({
			total: 3,
			doneCount: 1,
			percent: 33,
		})
	})

	it("returns 0% for an empty list", () => {
		expect(computeTodoProgress([]).percent).toBe(0)
	})
})

describe("filterTodoItems", () => {
	const items = [
		item({ id: 1, name: "Alien", done: true }),
		item({ id: 2, name: "Aliens", done: false }),
		item({ id: 3, name: "Heat", done: true }),
	]

	it("matches names case-insensitively", () => {
		expect(filterTodoItems(items, { query: "alien" }).map((i) => i.id)).toEqual(
			[1, 2],
		)
	})

	it("filters by done/to-do status", () => {
		expect(filterTodoItems(items, { status: "todo" }).map((i) => i.id)).toEqual(
			[2],
		)
		expect(filterTodoItems(items, { status: "done" }).map((i) => i.id)).toEqual(
			[1, 3],
		)
	})

	it("combines query and status", () => {
		expect(
			filterTodoItems(items, { query: "alien", status: "done" }).map(
				(i) => i.id,
			),
		).toEqual([1])
	})
})

describe("sortTodoItems", () => {
	const items = [
		item({ id: 1, name: "Zulu", year: 1999 }),
		item({ id: 2, name: "Alpha", year: 1999 }),
		item({ id: 3, name: "Beta", year: 1980 }),
	]

	it("sorts oldest first, breaking year ties alphabetically", () => {
		expect(sortTodoItems(items, "year-asc").map((i) => i.id)).toEqual([3, 2, 1])
	})

	it("sorts newest first, still breaking ties alphabetically", () => {
		expect(sortTodoItems(items, "year-desc").map((i) => i.id)).toEqual([
			2, 1, 3,
		])
	})
})
