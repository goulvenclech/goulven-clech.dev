/**
 * Server-side loading for the to-do lists. Kept out of `catalogueTodo.ts`,
 * which is also bundled for the browser: the eager glob would ship every list.
 */
import type { Client } from "@libsql/client"
import {
	indexReviews,
	type ReviewRow,
	type TodoEmotion,
	type TodoList,
	type TodoReview,
} from "$src/catalogueTodo"

/** Every curated list, alphabetical. */
export const todoLists: TodoList[] = Object.values(
	import.meta.glob<{ default: TodoList }>("/src/data/lists/*.json", {
		eager: true,
	}),
)
	.map((module) => module.default)
	.sort((a, b) => a.title.localeCompare(b.title))

export interface TodoReviewIndex {
	doneBySource: Map<string, Map<string, string>>
	reviewsBySource: Map<string, Map<string, TodoReview>>
	namesBySource: Map<string, Map<string, string>>
	postersBySource: Map<string, Map<string, string>>
	emotionsById: Map<string, TodoEmotion>
}

/**
 * The catalogue reviews the lists need, indexed per source. A failed query
 * degrades to "nothing done": the lists are static and still worth showing.
 */
export async function loadTodoReviews(
	client: Client,
	lists: TodoList[],
): Promise<TodoReviewIndex> {
	const index: TodoReviewIndex = {
		doneBySource: new Map(),
		reviewsBySource: new Map(),
		namesBySource: new Map(),
		postersBySource: new Map(),
		emotionsById: new Map(),
	}
	try {
		const emotionRows = await client.execute(
			"SELECT id, emoji, name FROM emotions WHERE is_deleted = false",
		)
		for (const row of emotionRows.rows as unknown as {
			id: number | string
			emoji: string
			name: string
		}[])
			index.emotionsById.set(String(row.id), {
				emoji: row.emoji,
				name: row.name,
			})

		for (const source of new Set(lists.map((list) => list.source))) {
			const result = await client.execute({
				sql: "SELECT source_id, source_name, source_img, rating, emotions FROM reviews WHERE source = ? ORDER BY inserted_at DESC",
				args: [source],
			})
			const { done, reviews, names, posters } = indexReviews(
				result.rows as unknown as ReviewRow[],
			)
			index.doneBySource.set(source, done)
			index.reviewsBySource.set(source, reviews)
			index.namesBySource.set(source, names)
			index.postersBySource.set(source, posters)
		}
	} catch (error) {
		console.error("catalogue to-do: could not load reviews", error)
	}
	return index
}
