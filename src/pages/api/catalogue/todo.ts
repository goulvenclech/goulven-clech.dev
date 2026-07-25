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

function json(payload: unknown, status = 200, cacheSeconds = 0): Response {
	const headers: Record<string, string> = { "Content-Type": "application/json" }
	if (cacheSeconds)
		headers["Cache-Control"] =
			`public, max-age=${cacheSeconds}, stale-while-revalidate=${Math.round(cacheSeconds / 2)}`

	return new Response(JSON.stringify(payload), { status, headers })
}

/** Ids are slugs and titles carry accents, so compare both leniently. */
const normalise = (value: string) => value.trim().toLowerCase().normalize("NFC")

/**
 * Read-only JSON of the curated to-do lists with completion computed against
 * the catalogue — the machine-readable twin of /catalogue/todo, consumed by the
 * catalogue MCP server. `?list=` selects one by id or title, `?items=false`
 * omits the entries. An unknown list answers 404 rather than an empty result.
 */
export async function GET(
	{ url }: APIContext,
	client: Client = getClient(),
	lists: TodoList[] = todoLists,
): Promise<Response> {
	const withItems = url.searchParams.get("items") !== "false"
	const wanted = url.searchParams.get("list")
	const key = wanted === null ? null : normalise(wanted)

	const selected =
		key === null
			? lists
			: lists.filter(
					(list) => normalise(list.id) === key || normalise(list.title) === key,
				)

	if (key !== null && selected.length === 0)
		return json(
			{
				error: `Unknown to-do list "${wanted}". Available: ${lists
					.map((list) => list.id)
					.join(", ")}.`,
			},
			404,
		)

	const { doneBySource, namesBySource, postersBySource } =
		await loadTodoReviews(client, selected)

	const payload = selected.map((list) => {
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
			...(withItems ? { items } : {}),
		}
	})

	return json({ lists: payload }, 200, 3600)
}
