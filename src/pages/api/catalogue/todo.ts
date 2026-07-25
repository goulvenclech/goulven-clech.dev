import type { APIContext } from "astro"
import type { Client } from "@libsql/client"
import { getClient } from "$src/db"
import {
	buildTodoItems,
	computeTodoProgress,
	type TodoList,
} from "$src/catalogueTodo"
import { loadTodoReviews, todoLists } from "$src/catalogueTodoData"

export const prerender = false // Reads the live catalogue, must not prerender.

/**
 * Read-only JSON of the curated to-do lists with completion computed against
 * the catalogue — the machine-readable twin of /catalogue/todo, consumed by the
 * catalogue MCP server.
 */
export async function GET(
	_context: APIContext,
	client: Client = getClient(),
	lists: TodoList[] = todoLists,
): Promise<Response> {
	const { doneBySource, namesBySource, postersBySource } =
		await loadTodoReviews(client, lists)

	const payload = lists.map((list) => {
		const items = buildTodoItems(
			list,
			doneBySource.get(list.source) ?? new Map(),
			namesBySource.get(list.source) ?? new Map(),
			postersBySource.get(list.source) ?? new Map(),
		)
		return {
			id: list.id,
			title: list.title,
			description: list.description,
			source: list.source,
			url: list.url ?? null,
			progress: computeTodoProgress(items),
			items,
		}
	})

	return new Response(JSON.stringify({ lists: payload }), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600, stale-while-revalidate=1800",
		},
	})
}
