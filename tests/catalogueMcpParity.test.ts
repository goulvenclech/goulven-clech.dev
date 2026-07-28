/**
 * The MCP package cannot import site modules, so it mirrors a few small tables
 * by hand. These assertions are the only guard against those mirrors drifting.
 */
import { describe, it, expect } from "vitest"

import {
	PAGE_SIZE,
	RATING_LABELS,
	TYPE_TO_SOURCE,
} from "../packages/catalogue-mcp/src/catalogue"
import { MAX_LIMIT } from "../src/catalogue/reviewQueries"
import { ratingLabels, sourceNouns } from "../src/catalogue/reviewUtils"

describe("MCP mirrored tables", () => {
	it("keeps the MCP rating labels identical to the site's", () => {
		expect(RATING_LABELS).toStrictEqual(ratingLabels)
	})

	it("maps the MCP media types onto exactly the site's review sources", () => {
		expect(Object.values(TYPE_TO_SOURCE).sort()).toStrictEqual(
			Object.keys(sourceNouns).sort(),
		)
	})

	it("keeps the MCP page size equal to the reviews API page cap", () => {
		expect(PAGE_SIZE).toBe(MAX_LIMIT)
	})
})
