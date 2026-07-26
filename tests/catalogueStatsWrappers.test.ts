import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

/**
 * The public entry points `getReviewFacts`/`getEmotionStats` wrap the fetches
 * with three behaviours the pivot tests never touch: degrade to `[]` (with a
 * warning) when the database rejects, fetch at most once per build, and fail
 * loudly when the Turso config is missing. The db module is mocked here so the
 * wrappers run against a controllable client; the real queries are covered in
 * `catalogueStats.test.ts` against in-memory libsql.
 */
const db = vi.hoisted(() => ({
	execute: vi.fn<() => Promise<{ rows: unknown[] }>>(),
}))

vi.mock("$src/db", () => ({
	getClient: () => ({ execute: db.execute }),
}))

/** The caches are module-level, so every case needs a fresh module instance. */
async function loadStats() {
	vi.resetModules()
	return import("../src/catalogue/stats")
}

beforeEach(() => {
	db.execute.mockReset()
	vi.stubEnv("TURSO_URL", "libsql://test.turso.io")
	vi.stubEnv("TURSO_TOKEN", "test-token")
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe.each([
	[
		"getReviewFacts",
		(m: Awaited<ReturnType<typeof loadStats>>) => m.getReviewFacts,
	] as const,
	[
		"getEmotionStats",
		(m: Awaited<ReturnType<typeof loadStats>>) => m.getEmotionStats,
	] as const,
])("%s", (_name, pick) => {
	it("degrades to an empty dataset with a warning when the fetch rejects", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
		db.execute.mockRejectedValue(new Error("turso hiccup"))

		const get = pick(await loadStats())
		await expect(get()).resolves.toEqual([])
		expect(warn).toHaveBeenCalledTimes(1)
	})

	it("fetches at most once per build, even after a failure", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {})
		db.execute.mockRejectedValue(new Error("turso hiccup"))

		const get = pick(await loadStats())
		const first = get()
		expect(get()).toBe(first)
		await first
		// A rejected fetch is not retried either: the build sees one dataset.
		expect(get()).toBe(first)
		expect(db.execute).toHaveBeenCalledTimes(1)
	})

	it("throws when the Turso config is missing instead of degrading", async () => {
		vi.stubEnv("TURSO_URL", "")

		const get = pick(await loadStats())
		expect(() => get()).toThrow(/TURSO_URL/)
		expect(db.execute).not.toHaveBeenCalled()
	})
})
