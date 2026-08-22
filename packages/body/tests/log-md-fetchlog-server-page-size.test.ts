import { describe, expect, it } from "vitest"
import { fetchLog } from "$src/remoteLog"
import { LOG_SCHEMA_VERSION, type LogEntry } from "$src/schemas"

const entryId = (n: number) =>
	`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const wellness = (n: number): LogEntry => ({
	kind: "wellness",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: entryId(n),
	date: "2026-08-17",
	sleepHours: 8,
})

// The server's page size is not the client's LOG_PAGE — different packages,
// no shared constant.
describe("fetchLog with a server page size smaller than the client's LOG_PAGE", () => {
	it("still fetches the whole log", async () => {
		const SERVER_PAGE = 100
		const TOTAL = 250
		const all = Array.from({ length: TOTAL }, (_, i) => wellness(i + 1))

		const fetchFn = (async (url: string) => {
			const since = Number(new URL(String(url)).searchParams.get("since"))
			const rows = all.slice(since, since + SERVER_PAGE)
			const cursor = rows.length ? since + rows.length : since
			return Response.json({ entries: rows, cursor, max: TOTAL })
		}) as unknown as typeof fetch

		const { entries, unreadable } = await fetchLog(fetchFn)

		expect(unreadable).toBe(0)
		expect(entries).toHaveLength(TOTAL)
	})
})
