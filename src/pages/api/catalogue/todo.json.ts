import type { APIContext } from "astro"
import type { Client } from "@libsql/client"
import { getClient } from "$src/db"
import { ratingLabels } from "$components/catalogue/reviewUtils"
import {
	buildTodoItems,
	computeTodoProgress,
	type TodoList,
} from "$src/catalogueTodo"

export const prerender = false // Reads the live catalogue, must not prerender.

// Curated lists are static files, loaded once like the /catalogue/todo page.
const lists = Object.values(
	import.meta.glob<{ default: TodoList }>("/src/data/lists/*.json", {
		eager: true,
	}),
)
	.map((module) => module.default)
	.sort((a, b) => a.title.localeCompare(b.title))

/**
 * Read-only JSON of the curated to-do lists with completion computed against
 * the catalogue — the machine-readable twin of /catalogue/todo, consumed by the
 * catalogue MCP server. Mirrors that page's completion logic and its resilience:
 * a failed reviews query degrades to "nothing done" rather than erroring, since
 * the list definitions are static and still worth returning.
 */
export async function GET(
	_context: APIContext,
	client: Client = getClient(),
	todoLists: TodoList[] = lists,
): Promise<Response> {
	// Latest rating emoji per reviewed id, for each source the lists need.
	const doneBySource = new Map<string, Map<string, string>>()
	try {
		for (const source of new Set(todoLists.map((list) => list.source))) {
			const result = await client.execute({
				sql: "SELECT source_id, rating FROM reviews WHERE source = ? ORDER BY inserted_at DESC",
				args: [source],
			})
			const done = new Map<string, string>()
			for (const row of result.rows as unknown as {
				source_id: string
				rating: number
			}[]) {
				const id = String(row.source_id)
				if (!done.has(id)) done.set(id, ratingLabels[row.rating]?.emoji ?? "")
			}
			doneBySource.set(source, done)
		}
	} catch (err) {
		console.error("GET /api/catalogue/todo.json failed:", err)
	}

	const payload = todoLists.map((list) => {
		const items = buildTodoItems(
			list,
			doneBySource.get(list.source) ?? new Map(),
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
