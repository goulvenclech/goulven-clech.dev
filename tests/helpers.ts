import { vi, expect } from "vitest"
import type { APIContext } from "astro"

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

export function expectJsonResponse(
	response: Response,
	expectedStatus = 200,
): void {
	expect(response.status).toBe(expectedStatus)
	expect(response.headers.get("Content-Type")).toBe("application/json")
}

export function expectCacheHeaders(response: Response, maxAge: number): void {
	const cacheControl = response.headers.get("Cache-Control")
	expect(cacheControl).toContain(`max-age=${maxAge}`)
}

// Avoids hitting real database in tests
export function createMockDbClient(
	mockResults: Record<string, unknown[]> = {},
) {
	return {
		execute: vi.fn(async (sql: string) => {
			for (const [pattern, rows] of Object.entries(mockResults)) {
				if (sql.includes(pattern)) {
					return { rows }
				}
			}
			return { rows: [] }
		}),
		batch: vi.fn(async () => []),
		close: vi.fn(),
	}
}

export const sampleReview = {
	id: "test-review-1",
	source: "game",
	source_id: "12345",
	source_name: "Test Game",
	source_link: "https://example.com/game",
	source_img: "https://example.com/image.jpg",
	source_img_focus_y: 0.5,
	rating: 5,
	emotions: [1, 3],
	comment: "Great game!",
	inserted_at: "2025-01-01T00:00:00Z",
	meta: "{}",
} as const

export const sampleEmotions = [
	{ id: 1, name: "Joy", color: "#FFD700" },
	{ id: 2, name: "Sadness", color: "#4169E1" },
	{ id: 3, name: "Fear", color: "#800080" },
] as const
