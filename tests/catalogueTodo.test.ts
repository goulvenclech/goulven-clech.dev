import { describe, it, expect } from "vitest"
import {
	buildTodoItems,
	computeTodoProgress,
	computeTodoStats,
	filterTodoItems,
	formatTodoStats,
	sortTodoItems,
	type TodoItem,
	type TodoList,
	type TodoReview,
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
		const [done, todo] = buildTodoItems(movies, new Map([["1", "😍"]]))

		expect(done).toMatchObject({ done: true, emoji: "😍" })
		expect(done.href).toBe("/catalogue?query=Seen&source=TMDB_MOVIE")
		expect(todo).toMatchObject({ done: false, emoji: null })
		expect(todo.href).toBe("https://example.com/2")
	})

	it("uses the list's own source in the catalogue deep-link", () => {
		const games = list("IGDB", [entry(1029, "Ocarina of Time")])
		const [game] = buildTodoItems(games, new Map([["1029", "⭐"]]))
		expect(game.href).toBe("/catalogue?query=Ocarina%20of%20Time&source=IGDB")
	})

	it("matches a book entry on its Open Library OLID string id", () => {
		const books = list("OPENLIBRARY", [
			{
				id: "OL9701864M",
				name: "The Fate of Knowledge",
				year: 2002,
				poster: null,
				link: "https://openlibrary.org/books/OL9701864M",
			},
		])
		const [book] = buildTodoItems(books, new Map([["OL9701864M", "😍"]]))
		expect(book).toMatchObject({ done: true, emoji: "😍" })
		expect(book.href).toBe(
			"/catalogue?query=The%20Fate%20of%20Knowledge&source=OPENLIBRARY",
		)
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

describe("computeTodoStats", () => {
	const emotions = new Map([
		["1", { emoji: "😍", name: "joy" }],
		["2", { emoji: "🥹", name: "moved" }],
		["3", { emoji: "✨", name: "wonder" }],
		["4", { emoji: "😱", name: "fear" }],
	])

	const doneItem = (id: number) => item({ id, done: true })
	const reviews = (pairs: [number, TodoReview][]) =>
		new Map(pairs.map(([id, review]) => [String(id), review]))

	it("returns null below three reviewed entries", () => {
		const items = [doneItem(1), doneItem(2)]
		const map = reviews([
			[1, { rating: 5, emotions: [1] }],
			[2, { rating: 4, emotions: [1] }],
		])
		expect(computeTodoStats(items, map, emotions)).toBeNull()
	})

	it("includes exactly three reviewed entries", () => {
		const items = [doneItem(1), doneItem(2), doneItem(3)]
		const map = reviews([
			[1, { rating: 5, emotions: [1] }],
			[2, { rating: 4, emotions: [2] }],
			[3, { rating: 4, emotions: [1] }],
		])
		expect(computeTodoStats(items, map, emotions)).not.toBeNull()
	})

	it("averages ratings to an emoji + verb and ranks the top three emotions", () => {
		const items = [1, 2, 3, 4, 5].map(doneItem)
		const map = reviews([
			[1, { rating: 5, emotions: [1, 2] }],
			[2, { rating: 4, emotions: [1, 3] }],
			[3, { rating: 4, emotions: [1, 4] }],
			[4, { rating: 5, emotions: [2, 3] }],
			[5, { rating: 3, emotions: [1] }],
		])
		const stats = computeTodoStats(items, map, emotions)!
		// mean(5,4,4,5,3) = 4.2 → 4 → 😀 liked
		expect(stats.averageEmoji).toBe("😀")
		expect(stats.averageVerb).toBe("liked")
		// joy×4, moved×2, wonder×2, fear×1 → top 3, ties broken by name
		expect(stats.emotions.map((e) => e.name)).toEqual([
			"joy",
			"moved",
			"wonder",
		])
	})

	it("ignores unknown emotion ids and to-do entries", () => {
		const items = [
			doneItem(1),
			doneItem(2),
			doneItem(3),
			doneItem(4),
			item({ id: 9 }),
		]
		const map = reviews([
			[1, { rating: 6, emotions: [1, 99] }],
			[2, { rating: 6, emotions: [1] }],
			[3, { rating: 5, emotions: [2] }],
			[4, { rating: 5, emotions: [99] }],
		])
		const stats = computeTodoStats(items, map, emotions)!
		// mean(6,6,5,5) = 5.5 → 6 → ⭐; unknown id 99 never fills a slot
		expect(stats.averageEmoji).toBe("⭐")
		expect(stats.emotions.map((e) => e.name)).toEqual(["joy", "moved"])
	})
})

describe("formatTodoStats", () => {
	it("writes a wrapped-style sentence with italic emotion names", () => {
		expect(
			formatTodoStats({
				averageEmoji: "😀",
				averageVerb: "liked",
				emotions: [
					{ emoji: "😍", name: "joy" },
					{ emoji: "🥹", name: "moved" },
				],
			}),
		).toBe("On average liked 😀, and mostly felt <i>joy</i>, <i>moved</i>.")
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
