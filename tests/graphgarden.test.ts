import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createEndpointContext, parseJsonResponse } from "./helpers"

vi.mock("astro:content", () => ({
	getCollection: vi.fn(),
}))

vi.mock("src/utils", () => ({
	isEntryPublished: vi.fn(() => true),
}))

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>()
	const mockReadFileSync = vi.fn(
		() =>
			"Check out [the about page](/about) and visit [Erika](https://erika.florist/blog)",
	)
	return {
		...actual,
		default: { ...actual, readFileSync: mockReadFileSync },
		readFileSync: mockReadFileSync,
	}
})

vi.mock("node:path", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:path")>()
	const mockJoin = (...args: string[]) => args.join("/")
	return {
		...actual,
		default: { ...actual, join: mockJoin },
		join: mockJoin,
	}
})

import {
	normalizeUrl,
	isFriendUrl,
	extractLinks,
	isInternalUrl,
	GET,
	prerender,
} from "../src/pages/.well-known/graphgarden.json"
import { readFileSync } from "node:fs"
import { getCollection } from "astro:content"

const SITE_ORIGIN = "https://goulven-clech.dev"

function mockBlogEntry(overrides: Record<string, unknown> = {}) {
	return {
		id: "2025/test-entry",
		body: "Check out [the about page](/about) and visit [Erika](https://erika.florist/blog)",
		data: {
			title: "Test Entry",
			date: new Date("2025-06-15"),
			published: "1.8.0",
			tags: [],
			abstract: "A test entry",
		},
		...overrides,
	}
}

describe("normalizeUrl", () => {
	it("preserves bare root slash", () => {
		expect(normalizeUrl("/")).toBe("/")
	})

	it("strips trailing slash from paths", () => {
		expect(normalizeUrl("/about/")).toBe("/about")
	})

	it("leaves paths without trailing slash unchanged", () => {
		expect(normalizeUrl("/about")).toBe("/about")
	})
})

describe("isFriendUrl", () => {
	it("matches a friend URL with path", () => {
		expect(isFriendUrl("https://erika.florist/blog")).toBe(true)
	})

	it("matches a bare friend domain without trailing slash", () => {
		expect(isFriendUrl("https://erika.florist")).toBe(true)
	})

	it("rejects a non-friend URL", () => {
		expect(isFriendUrl("https://example.com/page")).toBe(false)
	})
})

describe("isInternalUrl", () => {
	it("returns true for paths starting with /", () => {
		expect(isInternalUrl("/about", SITE_ORIGIN)).toBe(true)
	})

	it("returns true for URLs starting with the site origin", () => {
		expect(isInternalUrl(`${SITE_ORIGIN}/about`, SITE_ORIGIN)).toBe(true)
	})

	it("returns false for external URLs", () => {
		expect(isInternalUrl("https://example.com", SITE_ORIGIN)).toBe(false)
	})
})

describe("extractLinks", () => {
	it("extracts markdown links", () => {
		const content = "Visit [my site](/about) for more"
		const links = extractLinks(content, SITE_ORIGIN)
		expect(links).toContainEqual({ url: "/about", type: "internal" })
	})

	it("extracts HTML anchor links", () => {
		const content = '<a href="/resume">Resume</a>'
		const links = extractLinks(content, SITE_ORIGIN)
		expect(links).toContainEqual({ url: "/resume", type: "internal" })
	})

	it("classifies internal links starting with /", () => {
		const content = "[Blog](/2025/some-post)"
		const links = extractLinks(content, SITE_ORIGIN)
		expect(links).toHaveLength(1)
		expect(links[0].type).toBe("internal")
	})

	it("classifies friend links", () => {
		const content = "Check out [Erika](https://erika.florist/blog)"
		const links = extractLinks(content, SITE_ORIGIN)
		expect(links).toContainEqual({
			url: "https://erika.florist/blog",
			type: "friend",
		})
	})

	it("skips mailto and fragment links", () => {
		const content = "[Email](mailto:me@example.com) and [Section](#heading)"
		const links = extractLinks(content, SITE_ORIGIN)
		expect(links).toHaveLength(0)
	})

	it("returns empty array for content with no links", () => {
		const content = "Just some plain text without any links."
		const links = extractLinks(content, SITE_ORIGIN)
		expect(links).toHaveLength(0)
	})
})

interface GraphGardenResponse {
	readonly version: string
	readonly generated_at: string
	readonly base_url: string
	readonly site: {
		readonly title: string
		readonly description: string
		readonly language: string
	}
	readonly friends: readonly string[]
	readonly nodes: ReadonlyArray<{
		readonly url: string
		readonly title: string
	}>
	readonly edges: ReadonlyArray<{
		readonly source: string
		readonly target: string
		readonly type: "internal" | "friend"
	}>
}

describe("GET handler", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getCollection).mockImplementation((collection: string) => {
			if (collection === "blog") {
				return Promise.resolve([mockBlogEntry()] as never)
			}
			return Promise.resolve([] as never)
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("returns valid JSON with required GraphGarden fields", async () => {
		const context = createEndpointContext("/.well-known/graphgarden.json")
		const response = await GET(context)
		const data = await parseJsonResponse<GraphGardenResponse>(response)

		expect(response.status).toBe(200)
		expect(response.headers.get("Content-Type")).toBe("application/json")
		expect(data.version).toBe("0.2.0")
		expect(data.generated_at).toBeDefined()
		expect(data.base_url).toBeDefined()
		expect(data.site.title).toBeDefined()
		expect(data.site.description).toBeDefined()
		expect(data.site.language).toBe("en")
		expect(data.nodes.length).toBeGreaterThan(0)
		expect(data.edges.length).toBeGreaterThan(0)
	})

	it("includes static pages as nodes", async () => {
		const context = createEndpointContext("/.well-known/graphgarden.json")
		const response = await GET(context)
		const data = await parseJsonResponse<GraphGardenResponse>(response)

		const urls = data.nodes.map((node) => node.url)
		expect(urls).toContain("/")
		expect(urls).toContain("/about")
		expect(urls).toContain("/resume")
		expect(urls).toContain("/catalogue")
	})

	it("creates year nodes from blog entries", async () => {
		const context = createEndpointContext("/.well-known/graphgarden.json")
		const response = await GET(context)
		const data = await parseJsonResponse<GraphGardenResponse>(response)

		const urls = data.nodes.map((node) => node.url)
		expect(urls).toContain("/?year=2025")
	})

	it("creates edges from blog entries to year nodes", async () => {
		const context = createEndpointContext("/.well-known/graphgarden.json")
		const response = await GET(context)
		const data = await parseJsonResponse<GraphGardenResponse>(response)

		const edge = data.edges.find(
			(e) => e.source === "/2025/test-entry" && e.target === "/?year=2025",
		)
		expect(edge).toBeDefined()
		expect(edge!.type).toBe("internal")
	})

	it("includes friends array with expected URLs", async () => {
		const context = createEndpointContext("/.well-known/graphgarden.json")
		const response = await GET(context)
		const data = await parseJsonResponse<GraphGardenResponse>(response)

		expect(data.friends).toContain("https://aureliendossantos.com")
		expect(data.friends).toContain("https://erika.florist")
		expect(data.friends).toContain("https://bruits.org")
	})

	it("is prerendered at build time", () => {
		expect(prerender).toBe(true)
	})

	it("does not use readFileSync for content collection entries", async () => {
		const context = createEndpointContext("/.well-known/graphgarden.json")
		await GET(context)
		const calls = vi.mocked(readFileSync).mock.calls
		for (const [filePath] of calls) {
			expect(String(filePath)).not.toContain("content/blog")
			expect(String(filePath)).not.toContain("content/changelog")
			expect(String(filePath)).not.toContain("content/experiences")
		}
	})
})
