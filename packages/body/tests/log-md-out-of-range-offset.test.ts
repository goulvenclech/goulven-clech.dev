import { describe, expect, it } from "vitest"
import { renderLog, type LogView } from "$src/pages/log.md"

const SITE = "https://example.com"

const outOfRange: LogView = {
	site: SITE,
	limit: 14,
	offset: 999,
	showHelp: true,
	days: [],
	totalDays: 1,
	totalEntries: 3,
	skipped: 0,
}

describe("renderLog with an out-of-range offset", () => {
	it("does not claim an empty log when days exist", () => {
		const document = renderLog(outOfRange)
		expect(document).toContain("Showing 0 of 1 days.")
		expect(document).not.toContain("Nothing logged yet.")
	})

	it("prints an absolute first-page URL to recover in one fetch", () => {
		expect(renderLog(outOfRange)).toContain(`${SITE}/log.md\n`)
	})

	it("steps Previous back into the log, not through empty pages", () => {
		expect(renderLog(outOfRange)).toContain(`Previous page: ${SITE}/log.md\n`)
	})
})
