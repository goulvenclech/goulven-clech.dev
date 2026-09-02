import { describe, expect, it } from "vitest"
import { groupByDay } from "$src/dayLog"
import {
	buildLogQueryString,
	parseLogQuery,
	renderDayBlock,
	renderLogMd,
	type LogView,
} from "$src/pages/log.md"
import { fetchLog } from "$src/remoteLog"
import { LOG_SCHEMA_VERSION, type LogEntry } from "$src/schemas"

const SITE = "https://example.com"

const entryId = (n: number) =>
	`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const strengthEntry: LogEntry = {
	kind: "strength",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: entryId(1),
	date: "2026-08-17",
	session: "strength-a",
	ref: "back-squat",
	set: 1,
	kg: 60,
	reps: 5,
	unit: "reps",
}

const conditioningEntry: LogEntry = {
	kind: "conditioning",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: entryId(2),
	date: "2026-08-17",
	category: "Cardio",
	workout: "cardio go",
	level: 3,
	sets: 5,
}

const skippedEntry: LogEntry = {
	kind: "skipped",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: entryId(4),
	date: "2026-08-18",
	planned: "Cardio",
	reason: "ill",
}

const wellnessEntry: LogEntry = {
	kind: "wellness",
	schemaVersion: LOG_SCHEMA_VERSION,
	id: entryId(3),
	date: "2026-08-17",
	sleepHours: 9,
	steps: 4200,
}

function view(overrides: Partial<LogView> = {}): LogView {
	const days = groupByDay([strengthEntry, conditioningEntry, wellnessEntry])
	return {
		site: SITE,
		limit: 14,
		offset: 0,
		showHelp: true,
		days,
		totalDays: days.length,
		totalEntries: 3,
		unreadable: 0,
		...overrides,
	}
}

describe("parseLogQuery", () => {
	const parse = (qs: string) => parseLogQuery(new URL(`${SITE}/log.md${qs}`))

	it("defaults to 14 days from the most recent", () => {
		expect(parse("")).toEqual({ limit: 14, offset: 0 })
	})

	it("clamps limit into 1-90 and ignores garbage", () => {
		expect(parse("?limit=0").limit).toBe(1)
		expect(parse("?limit=999").limit).toBe(90)
		expect(parse("?limit=abc").limit).toBe(14)
		expect(parse("?offset=-3").offset).toBe(0)
	})
})

describe("buildLogQueryString", () => {
	it("omits defaults and puts help last", () => {
		expect(buildLogQueryString(14, 0)).toBe("")
		expect(buildLogQueryString(90, 0)).toBe("?limit=90")
		expect(buildLogQueryString(14, 14, false)).toBe("?offset=14&help=0")
	})
})

describe("renderDayBlock", () => {
	it("resolves refs to names and lines up the day's entries", () => {
		const [day] = groupByDay([strengthEntry, conditioningEntry, wellnessEntry])
		expect(renderDayBlock(day).split("\n")).toEqual([
			"## 2026-08-17 (Monday) — Strength · Cardio",
			"",
			"- Back squat: 60 kg × 5",
			"- cardio go (Cardio): level 3 · 5 sets",
			"- Wellness: 9 h sleep · 4200 steps",
		])
	})

	it("leads a skipped day with the plan it replaced", () => {
		const [day] = groupByDay([skippedEntry])
		expect(renderDayBlock(day).split("\n")).toEqual([
			"## 2026-08-18 (Tuesday) — Skipped",
			"",
			"- Skipped Cardio: ill",
		])
	})

	it("keeps a wellness-only day label-free", () => {
		const [day] = groupByDay([wellnessEntry])
		expect(renderDayBlock(day).split("\n")[0]).toBe("## 2026-08-17 (Monday)")
	})
})

describe("renderLogMd", () => {
	it("links the HTML twin and the other endpoints as absolute URLs", () => {
		const document = renderLogMd(view())
		for (const url of [
			`${SITE}/log/`,
			`${SITE}/index.md`,
			`${SITE}/stats.md`,
			`${SITE}/llms.txt`,
		])
			expect(document).toContain(url)
	})

	it("counts days and entries in the range line", () => {
		expect(renderLogMd(view())).toContain(
			"Showing days 1–1 of 1 · 3 entries in total.",
		)
	})

	it("says so when nothing is logged", () => {
		const empty = view({ days: [], totalDays: 0, totalEntries: 0 })
		expect(renderLogMd(empty)).toContain("Showing 0 of 0 days.")
		expect(renderLogMd(empty)).toContain("Nothing logged yet.")
	})

	it("prints absolute pagination links", () => {
		const paged = view({ limit: 1, offset: 1, totalDays: 3 })
		const document = renderLogMd(paged)
		expect(document).toContain(`Next page: ${SITE}/log.md?limit=1&offset=2`)
		expect(document).toContain(`Previous page: ${SITE}/log.md?limit=1`)
		expect(document).toContain(`Max page size: ${SITE}/log.md?limit=90`)
	})

	it("collapses the API section behind an absolute link", () => {
		const hidden = renderLogMd(view({ showHelp: false }))
		expect(hidden).toContain(
			`API guide hidden. Show pagination options: ${SITE}/log.md`,
		)
		expect(hidden).not.toContain("Free-form parameters")
		expect(renderLogMd(view())).toContain(
			`Hide this API section: ${SITE}/log.md?help=0`,
		)
	})

	it("flags entries newer than this build instead of failing", () => {
		expect(renderLogMd(view({ unreadable: 2 }))).toContain(
			"2 entries use a newer format than this page understands and are omitted.",
		)
	})
})

describe("fetchLog", () => {
	const page = (entries: unknown[], cursor: number, max: number) =>
		Response.json({ entries, cursor, max })

	it("follows the cursor to the server's max and skips unknown entries", async () => {
		const calls: string[] = []
		const fetchFn = (async (url: string) => {
			calls.push(String(url))
			return calls.length === 1
				? page([wellnessEntry], 500, 502)
				: page([strengthEntry, { kind: "teleportation" }], 502, 502)
		}) as unknown as typeof fetch

		const { entries, unreadable } = await fetchLog(fetchFn)

		expect(calls).toEqual([
			"http://localhost:4321/api/body/log?since=0",
			"http://localhost:4321/api/body/log?since=500",
		])
		expect(entries).toHaveLength(2)
		expect(unreadable).toBe(1)
	})

	it("keeps a withdrawn entry out of the twins", async () => {
		const retraction: LogEntry = {
			kind: "retraction",
			schemaVersion: LOG_SCHEMA_VERSION,
			id: entryId(5),
			date: strengthEntry.date,
			retracts: strengthEntry.id,
		}
		const fetchFn = (async () =>
			page(
				[strengthEntry, retraction, wellnessEntry],
				3,
				3,
			)) as unknown as typeof fetch

		const { entries, unreadable } = await fetchLog(fetchFn)

		expect(entries).toEqual([wellnessEntry])
		expect(unreadable).toBe(0)
	})

	it("throws on a failing backend", async () => {
		const fetchFn = (async () =>
			new Response("nope", { status: 500 })) as unknown as typeof fetch
		await expect(fetchLog(fetchFn)).rejects.toThrow("log fetch failed (500)")
	})
})
