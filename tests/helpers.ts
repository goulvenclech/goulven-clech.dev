import { vi } from "vitest"
import type { APIContext } from "astro"
import type { Client } from "@libsql/client"
import type { Review } from "../src/catalogue/apiTypes"

export function createMockAPIContext(
	overrides: Partial<APIContext> = {},
): APIContext {
	const url = new URL("http://localhost:4321/api/test")
	const request = new Request(url)

	return {
		site: new URL("http://localhost:4321"),
		generator: "Astro vX.X.X",
		url,
		request,
		params: {},
		props: {},
		redirect: vi.fn(
			(path: string, status?: number) =>
				new Response(null, {
					status: status ?? 302,
					headers: { Location: path },
				}),
		),
		rewrite: vi.fn(),
		locals: {},
		cookies: {
			get: vi.fn(),
			has: vi.fn(() => false),
			set: vi.fn(),
			delete: vi.fn(),
			merge: vi.fn(),
			headers: vi.fn(() => []),
		},
		preferredLocale: undefined,
		preferredLocaleList: undefined,
		currentLocale: undefined,
		getActionResult: vi.fn(),
		callAction: vi.fn(),
		routePattern: "/api/test",
		isPrerendered: false,
		originPathname: "/api/test",
		clientAddress: "127.0.0.1",
		...overrides,
	} as APIContext
}

export function createMockRequest(path: string, init?: RequestInit): Request {
	const url = new URL(path, "http://localhost:4321")
	return new Request(url, init)
}

export function createEndpointContext(
	path: string,
	options: {
		method?: string
		body?: BodyInit
		headers?: HeadersInit
		params?: Record<string, string>
	} = {},
): APIContext {
	const { method = "GET", body, headers, params = {} } = options
	const url = new URL(path, "http://localhost:4321")
	const request = new Request(url, { method, body, headers })

	return createMockAPIContext({ url, request, params })
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
	const text = await response.text()
	return JSON.parse(text) as T
}

// Avoids hitting real database in tests; returns rows whose pattern is a
// substring of the executed SQL. Rows may be a function of the bound args, for
// queries that differ only by parameter.
export function createMockDbClient(
	mockResults: Record<
		string,
		unknown[] | ((args: unknown[]) => unknown[])
	> = {},
): Client {
	return {
		execute: vi.fn(async (stmt: string | { sql: string; args?: unknown[] }) => {
			const sql = typeof stmt === "string" ? stmt : stmt.sql
			const args = typeof stmt === "string" ? [] : (stmt.args ?? [])
			for (const [pattern, rows] of Object.entries(mockResults)) {
				if (sql.includes(pattern)) {
					return { rows: typeof rows === "function" ? rows(args) : rows }
				}
			}
			return { rows: [] }
		}),
		// Same matching as execute, one result per statement; rowsAffected
		// mirrors the mocked row count so writes can signal affected rows.
		batch: vi.fn(
			async (stmts: (string | { sql: string; args?: unknown[] })[]) =>
				stmts.map((stmt) => {
					const sql = typeof stmt === "string" ? stmt : stmt.sql
					const args = typeof stmt === "string" ? [] : (stmt.args ?? [])
					for (const [pattern, rows] of Object.entries(mockResults)) {
						if (sql.includes(pattern)) {
							const matched = typeof rows === "function" ? rows(args) : rows
							return { rows: matched, rowsAffected: matched.length }
						}
					}
					return { rows: [], rowsAffected: 0 }
				}),
		),
		close: vi.fn(),
	} as unknown as Client
}

export const sampleReview = {
	id: 1,
	source: "game",
	source_id: "12345",
	source_name: "Test Game",
	source_link: "https://example.com/game",
	source_img: "https://example.com/image.jpg",
	rating: 5,
	emotions: [1, 3],
	comment: "Great game!",
	inserted_at: "2025-01-01T00:00:00Z",
	meta: "{}",
} satisfies Review
