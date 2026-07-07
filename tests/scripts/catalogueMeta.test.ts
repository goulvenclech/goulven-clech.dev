import { describe, it, expect, vi, afterEach } from "vitest"
import { enrichEntries } from "../../scripts/catalogueMeta.mjs"

afterEach(() => vi.unstubAllGlobals())

type Entry = { id: number | string; name: string; meta?: string }

// An IGDB game shaped like the fetchGameById response, and the pipe-delimited
// meta the catalogue builder derives from it.
const zelda = {
	genres: [{ name: "Adventure" }],
	collection: { name: "The Legend of Zelda" },
	involved_companies: [{ developer: true, company: { name: "Nintendo" } }],
	platforms: [{ name: "NES" }],
}
const zeldaMeta = "Adventure | The Legend of Zelda | Nintendo | NES"

// IGDB resolves via a Twitch token, then one game lookup per entry; mock both.
function mockIgdb() {
	const fetchMock = vi
		.fn()
		.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ access_token: "tok" }),
		})
		.mockResolvedValue({ ok: true, json: async () => [zelda] })
	vi.stubGlobal("fetch", fetchMock)
	return fetchMock
}

describe("enrichEntries", () => {
	it("resolves IGDB meta by id and mutates entries in place", async () => {
		const fetchMock = mockIgdb()
		const entries: Entry[] = [{ id: 1029, name: "Ocarina of Time" }]
		const result = await enrichEntries(
			{ IGDB_ID: "i", IGDB_SECRET: "s" },
			"IGDB",
			entries,
		)

		expect(entries[0].meta).toBe(zeldaMeta)
		expect(result).toEqual({ enriched: 1, skipped: 0 })
		expect(fetchMock).toHaveBeenCalledTimes(2) // token + one game
	})

	it("skips entries that already carry meta, fetching only what's missing", async () => {
		const fetchMock = mockIgdb()
		const entries: Entry[] = [
			{ id: 1, name: "Cached", meta: "old" },
			{ id: 2, name: "Fresh" },
		]
		const result = await enrichEntries(
			{ IGDB_ID: "i", IGDB_SECRET: "s" },
			"IGDB",
			entries,
		)

		expect(entries[0].meta).toBe("old")
		expect(entries[1].meta).toBe(zeldaMeta)
		expect(result).toEqual({ enriched: 1, skipped: 1 })
		expect(fetchMock).toHaveBeenCalledTimes(2) // token + only the meta-less game
	})

	it("leaves entries untouched for a source it can't resolve", async () => {
		const fetchMock = vi.fn()
		vi.stubGlobal("fetch", fetchMock)

		const entries: Entry[] = [{ id: 539, name: "Psycho" }]
		const result = await enrichEntries({}, "TMDB_MOVIE", entries)

		expect(entries[0].meta).toBeUndefined()
		expect(result).toEqual({ enriched: 0, skipped: 1 })
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("skips enrichment when the source's credentials are missing", async () => {
		const fetchMock = vi.fn()
		vi.stubGlobal("fetch", fetchMock)

		const entries: Entry[] = [{ id: 1029, name: "Ocarina of Time" }]
		const result = await enrichEntries({}, "IGDB", entries)

		expect(entries[0].meta).toBeUndefined()
		expect(result).toEqual({ enriched: 0, skipped: 1 })
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("skips enrichment without aborting when the token setup fails", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 })
		vi.stubGlobal("fetch", fetchMock)

		const entries: Entry[] = [{ id: 1029, name: "Ocarina of Time" }]
		const result = await enrichEntries(
			{ IGDB_ID: "i", IGDB_SECRET: "s" },
			"IGDB",
			entries,
		)

		expect(entries[0].meta).toBeUndefined()
		expect(result).toEqual({ enriched: 0, skipped: 1 })
		expect(fetchMock).toHaveBeenCalledTimes(1) // token attempt only, no game fetch
	})
})
