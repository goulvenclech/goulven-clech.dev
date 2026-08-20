// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
	bearerToken,
	corsHeaders,
	deriveSyncToken,
	parseIncomingEntries,
	preflight,
	safeEqual,
} from "../src/bodyLog"

describe("deriveSyncToken", () => {
	it("is deterministic and differs across secrets and passwords", () => {
		expect(deriveSyncToken("s1", "secret")).toBe(
			deriveSyncToken("s1", "secret"),
		)
		expect(deriveSyncToken("s1", "secret")).not.toBe(
			deriveSyncToken("s2", "secret"),
		)
		expect(deriveSyncToken("s1", "secret")).not.toBe(
			deriveSyncToken("s1", "other"),
		)
		expect(deriveSyncToken("s1", "secret")).toMatch(/^[0-9a-f]{64}$/)
	})

	it("refuses to run without the server secret", () => {
		expect(() => deriveSyncToken("", "secret")).toThrow(/BODY_SYNC_SECRET/)
	})
})

describe("safeEqual", () => {
	it("compares strings of any lengths without throwing", () => {
		expect(safeEqual("abc", "abc")).toBe(true)
		expect(safeEqual("abc", "abcd")).toBe(false)
		expect(safeEqual("", "abc")).toBe(false)
	})
})

describe("bearerToken", () => {
	it("extracts the token and rejects other schemes", () => {
		const request = (authorization?: string) =>
			new Request("http://localhost/", {
				headers: authorization ? { authorization } : {},
			})
		expect(bearerToken(request("Bearer abc123"))).toBe("abc123")
		expect(bearerToken(request("Basic abc123"))).toBeNull()
		expect(bearerToken(request())).toBeNull()
	})
})

describe("corsHeaders", () => {
	const request = (origin?: string) =>
		new Request("http://localhost/", {
			headers: origin ? { origin } : {},
		})

	it("echoes an allowed origin", () => {
		const headers = corsHeaders(request("https://body.goulven-clech.dev"))
		expect(headers["Access-Control-Allow-Origin"]).toBe(
			"https://body.goulven-clech.dev",
		)
	})

	it("stays silent for unknown or missing origins", () => {
		expect(corsHeaders(request("https://evil.example"))).toEqual({})
		expect(corsHeaders(request())).toEqual({})
	})

	it("answers preflight with methods and headers", () => {
		const response = preflight(request("http://localhost:4322"))
		expect(response.status).toBe(204)
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			"http://localhost:4322",
		)
		expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
			"authorization",
		)
	})
})

describe("parseIncomingEntries", () => {
	const entry = { id: "a".repeat(36), kind: "strength", kg: 60 }

	it("accepts a batch of objects with string ids", () => {
		const parsed = parseIncomingEntries({ entries: [entry] })
		expect(parsed).toHaveLength(1)
		expect(parsed?.[0].id).toBe(entry.id)
		expect(JSON.parse(parsed![0].json)).toEqual(entry)
	})

	it("rejects the whole batch on any malformed entry", () => {
		expect(parseIncomingEntries({ entries: [entry, { id: 5 }] })).toBeNull()
		expect(parseIncomingEntries({ entries: [{ ...entry, id: "" }] })).toBeNull()
		expect(parseIncomingEntries({ entries: [] })).toBeNull()
		expect(parseIncomingEntries({ entries: "nope" })).toBeNull()
		expect(parseIncomingEntries(null)).toBeNull()
	})

	it("caps entry size and batch length", () => {
		expect(
			parseIncomingEntries({
				entries: [{ ...entry, comment: "x".repeat(4000) }],
			}),
		).toBeNull()
		expect(
			parseIncomingEntries({
				entries: Array.from({ length: 501 }, (_, i) => ({
					...entry,
					id: `id-${i}`,
				})),
			}),
		).toBeNull()
	})
})
