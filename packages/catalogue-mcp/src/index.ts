#!/usr/bin/env node
/**
 * A local, read-only MCP server over the goulven-clech.dev catalogue and to-do
 * lists. Runs on stdio (no network listener, no auth) and reuses the site's
 * public JSON API for all data. Point it at another origin with CATALOGUE_BASE_URL.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { CatalogueClient } from "./catalogue.js"

const BASE_URL = process.env.CATALOGUE_BASE_URL ?? "https://goulven-clech.dev"
const client = new CatalogueClient(BASE_URL)

const server = new McpServer({ name: "catalogue-mcp", version: "0.1.0" })

/** Wrap a JSON-able result as MCP tool output. */
function ok(data: unknown) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
	}
}

/** Turn a thrown error into a non-crashing MCP tool error. */
function fail(err: unknown) {
	const message = err instanceof Error ? err.message : String(err)
	return { content: [{ type: "text" as const, text: message }], isError: true }
}

server.registerTool(
	"search_reviews",
	{
		description:
			"Search and filter Goulven's catalogue reviews (games, board games, films, TV shows, albums, books). " +
			"Returns full reviews — rating, emotions felt, and the written comment. " +
			"Every filter is optional; multiple filters combine with AND.",
		inputSchema: {
			query: z
				.string()
				.optional()
				.describe("Free-text search over title, comment and metadata"),
			type: z
				.enum(["game", "board-game", "movie", "tv-show", "album", "book"])
				.optional()
				.describe("Media type"),
			rating: z
				.number()
				.int()
				.min(1)
				.max(6)
				.optional()
				.describe(
					"Exact rating: 1 hated, 2 disliked, 3 meh, 4 liked, 5 loved, 6 favourite",
				),
			emotion: z
				.string()
				.optional()
				.describe(
					'Emotion name, e.g. "nostalgia" (see list_emotions for valid names)',
				),
			year: z
				.number()
				.int()
				.optional()
				.describe("Only reviews written during this year"),
			after: z
				.string()
				.regex(
					/^\d{4}(-\d{2}-\d{2})?$/,
					"Use a year (2023) or a day (2023-07-04)",
				)
				.optional()
				.describe("Only reviews on/after this date (YYYY or YYYY-MM-DD)"),
			before: z
				.string()
				.regex(
					/^\d{4}(-\d{2}-\d{2})?$/,
					"Use a year (2023) or a day (2023-07-04)",
				)
				.optional()
				.describe("Only reviews on/before this date (YYYY or YYYY-MM-DD)"),
			sort: z
				.enum(["date", "rating"])
				.optional()
				.describe("Sort order (default: date, newest first)"),
			limit: z
				.number()
				.int()
				.positive()
				.optional()
				.describe("Cap the number of reviews returned (default: all matches)"),
		},
	},
	async (args) => {
		try {
			return ok(await client.searchReviews(args))
		} catch (err) {
			return fail(err)
		}
	},
)

server.registerTool(
	"list_emotions",
	{
		description:
			"List the emotions Goulven tags reviews with — the valid values for the search_reviews emotion filter.",
		inputSchema: {},
	},
	async () => {
		try {
			return ok(await client.getEmotions())
		} catch (err) {
			return fail(err)
		}
	},
)

server.registerTool(
	"list_todo_lists",
	{
		description:
			"List Goulven's curated to-do lists (films to watch, games to play, books to read, …), " +
			"each with completion progress (done / total / percent).",
		inputSchema: {},
	},
	async () => {
		try {
			return ok(await client.listTodoLists())
		} catch (err) {
			return fail(err)
		}
	},
)

server.registerTool(
	"get_todo_list",
	{
		description:
			"Get a single to-do list's entries with their done / to-do status. " +
			"Optionally filter by completion status or entry name.",
		inputSchema: {
			id: z.string().describe("The list id or title (see list_todo_lists)"),
			status: z
				.enum(["all", "done", "todo"])
				.optional()
				.describe("Filter by completion status (default: all)"),
			query: z
				.string()
				.optional()
				.describe("Keep only entries whose name contains this text"),
		},
	},
	async ({ id, status, query }) => {
		try {
			return ok(await client.getTodoList(id, { status, query }))
		} catch (err) {
			return fail(err)
		}
	},
)

const transport = new StdioServerTransport()
await server.connect(transport)
