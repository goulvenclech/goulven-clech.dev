import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createEndpointContext, parseJsonResponse } from "./helpers"

vi.mock("astro:content", () => ({
	getCollection: vi.fn(),
}))

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>()
	const spy = vi.fn(actual.readFileSync)
	return {
		...actual,
		default: { ...actual, readFileSync: spy },
		readFileSync: spy,
	}
})

import { GET } from "../src/pages/.well-known/graphgarden.json"
import { existsSync, readFileSync } from "node:fs"
import { getCollection } from "astro:content"

interface GraphGardenEdges {
	readonly edges: ReadonlyArray<{
		source: string
		target: string
		type: string
	}>
}

async function generateWithWrapYear2025() {
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"))
	try {
		const response = await GET(
			createEndpointContext("/.well-known/graphgarden.json"),
		)
		return await parseJsonResponse<GraphGardenEdges>(response)
	} finally {
		vi.useRealTimers()
	}
}

describe("graphgarden page files (guard)", () => {
	beforeEach(() => {
		vi.mocked(readFileSync).mockClear()
		vi.mocked(getCollection).mockResolvedValue([] as never)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("only reads page files that exist on disk", async () => {
		await generateWithWrapYear2025()

		const readPaths = vi
			.mocked(readFileSync)
			.mock.calls.map(([path]) => String(path))

		expect(
			readPaths.some((p) => p.endsWith("catalogue/wrapped/[year].astro")),
		).toBe(true)
		for (const path of readPaths) {
			expect(existsSync(path), `missing page file: ${path}`).toBe(true)
		}
	})

	it("extracts the links of the real year template", async () => {
		const data = await generateWithWrapYear2025()

		expect(data.edges).toContainEqual({
			source: "/catalogue/wrapped/2025",
			target: "/catalogue",
			type: "internal",
		})
		expect(data.edges).not.toContainEqual({
			source: "/catalogue/wrapped/2025",
			target: "/about",
			type: "internal",
		})
	})
})
