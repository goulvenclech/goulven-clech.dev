import { describe, expect, it, vi } from "vitest"

vi.mock("$src/program", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$src/program")>()
	return {
		...actual,
		programFor: (date: string) =>
			// getUTCDay() === 1 → Monday, formerly "Full Body Strength".
			new Date(`${date}T00:00:00Z`).getUTCDay() === 1
				? { title: "Rest", kind: "rest" as const, location: null }
				: actual.programFor(date),
	}
})

import { adherence } from "$src/stats"

describe("adherence after an in-code program change", () => {
	it("keeps counting a session legitimately logged before the change", () => {
		// 2026-08-17 is a Monday inside the 28-day window ending 2026-08-19.
		const result = adherence(
			[{ date: "2026-08-17", status: "completed" }],
			"2026-08-19",
		)
		expect(result.done).toBe(1)
	})
})
