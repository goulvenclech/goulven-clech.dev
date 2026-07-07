import { describe, it, expect } from "vitest"
import {
	buildTodoItems,
	computeTodoProgress,
	computeTodoStats,
	filterTodoItems,
	formatTodoStats,
	indexReviews,
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

	it("deep-links a done entry via the review's exact source_name", () => {
		// source_name carries the catalogue's "Title (Year)" form, so the query
		// pins that one review even when the card title alone would be ambiguous.
		const movies = list("TMDB_MOVIE", [entry(1, "Rushmore")])
		const [movie] = buildTodoItems(
			movies,
			new Map([["1", "😍"]]),
			new Map([["1", "Rushmore (1998)"]]),
		)
		expect(movie.href).toBe(
			"/catalogue?query=Rushmore%20(1998)&source=TMDB_MOVIE",
		)
	})

	it("falls back to the entry title when no indexed name is given", () => {
		const movies = list("TMDB_MOVIE", [entry(1, "Rushmore")])
		const [movie] = buildTodoItems(movies, new Map([["1", "😍"]]))
		expect(movie.href).toBe("/catalogue?query=Rushmore&source=TMDB_MOVIE")
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

	it("carries an entry's catalogue meta onto the item for search", () => {
		const movies = list("TMDB_MOVIE", [
			{
				...entry(1, "Spirited Away"),
				meta: "Animation | Studio Ghibli | Hayao Miyazaki",
			},
		])
		const [movie] = buildTodoItems(movies, new Map())
		expect(movie.meta).toBe("Animation | Studio Ghibli | Hayao Miyazaki")
	})

	it("shows the review's own poster for a done entry", () => {
		// A seen film shows the poster the catalogue stored, not the list's — which
		// can drift as TMDB swaps its primary art between review time and now.
		const movies = list("TMDB_MOVIE", [entry(1, "Seen")])
		const [movie] = buildTodoItems(
			movies,
			new Map([["1", "😍"]]),
			new Map(),
			new Map([["1", "https://image.tmdb.org/t/p/w500/catalogue.jpg"]]),
		)
		expect(movie.poster).toBe("https://image.tmdb.org/t/p/w500/catalogue.jpg")
	})

	it("keeps the entry poster for a to-do entry or an empty review poster", () => {
		const movies = list("TMDB_MOVIE", [entry(1, "Seen"), entry(2, "Unseen")])
		const [seen, unseen] = buildTodoItems(
			movies,
			new Map([["1", "😍"]]),
			new Map(),
			new Map([["1", ""]]), // reviewed but no stored poster → use the entry's
		)
		expect(seen.poster).toBe("poster-1.jpg")
		expect(unseen.poster).toBe("poster-2.jpg")
	})
})

describe("indexReviews", () => {
	it("trims a stray-space source id so it still matches an entry's id", () => {
		const { done, reviews, names, posters } = indexReviews([
			{
				source_id: " 1556",
				source_name: "Alien (1979)",
				source_img: "https://image.tmdb.org/t/p/w500/alien.jpg",
				rating: 4,
				emotions: "[1]",
			},
		])
		expect(done.get("1556")).toBe("😀")
		expect(reviews.get("1556")).toEqual({ rating: 4, emotions: [1] })
		expect(names.get("1556")).toBe("Alien (1979)")
		expect(posters.get("1556")).toBe(
			"https://image.tmdb.org/t/p/w500/alien.jpg",
		)
	})

	it("keeps the newest row per id (rows arrive newest-first)", () => {
		const { done, reviews, names, posters } = indexReviews([
			{
				source_id: 7,
				source_name: "Heat (1995)",
				source_img: "heat-new.jpg",
				rating: 5,
				emotions: "[1,2]",
			},
			{
				source_id: 7,
				source_name: "Heat (stale)",
				source_img: "heat-old.jpg",
				rating: 2,
				emotions: "[3]",
			},
		])
		expect(done.get("7")).toBe("😍")
		expect(reviews.get("7")).toEqual({ rating: 5, emotions: [1, 2] })
		expect(names.get("7")).toBe("Heat (1995)")
		expect(posters.get("7")).toBe("heat-new.jpg")
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

	it("matches the catalogue meta, not just the title", () => {
		const withMeta = [
			item({
				id: 1,
				name: "Spirited Away",
				meta: "Animation | Studio Ghibli | Hayao Miyazaki",
			}),
			item({ id: 2, name: "Heat", meta: "Crime | Michael Mann | Al Pacino" }),
		]
		expect(
			filterTodoItems(withMeta, { query: "miyazaki" }).map((i) => i.id),
		).toEqual([1])
		expect(
			filterTodoItems(withMeta, { query: "ghibli" }).map((i) => i.id),
		).toEqual([1])
	})

	it("still filters when an item carries no meta", () => {
		const mixed = [
			item({ id: 1, name: "Alien" }),
			item({ id: 2, name: "Heat", meta: "Crime | Michael Mann" }),
		]
		expect(filterTodoItems(mixed, { query: "mann" }).map((i) => i.id)).toEqual([
			2,
		])
		expect(filterTodoItems(mixed, { query: "alien" }).map((i) => i.id)).toEqual(
			[1],
		)
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
