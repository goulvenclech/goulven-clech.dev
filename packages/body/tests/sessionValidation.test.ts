import { describe, expect, it } from "vitest"
import { parseSessionPayload } from "$src/sessionValidation"

const TODAY = "2026-08-19" // a Wednesday (combat day); 2026-08-17 is a Monday

const valid = {
	date: "2026-08-17",
	status: "completed",
	notes: "solid session",
	sets: [
		{ exercise: "squat", weight_kg: 80, reps: 5 },
		{ exercise: "pull-up", reps: 8 },
	],
}

describe("parseSessionPayload", () => {
	it("accepts a confirmed session and derives kind and patterns", () => {
		const result = parseSessionPayload(valid, TODAY)
		expect(result).toMatchObject({
			ok: true,
			session: {
				date: "2026-08-17",
				kind: "strength",
				status: "completed",
				skip_reason: null,
				notes: "solid session",
			},
		})
		if (!result.ok) return
		expect(result.session.sets).toEqual([
			{ exercise: "squat", pattern: "squat", weight_kg: 80, reps: 5 },
			{ exercise: "pull-up", pattern: "pull", weight_kg: null, reps: 8 },
		])
	})

	it("accepts a skipped session with a reason and no sets", () => {
		const result = parseSessionPayload(
			{ date: "2026-08-18", status: "skipped", skip_reason: "sick" },
			TODAY,
		)
		expect(result).toMatchObject({
			ok: true,
			session: { status: "skipped", skip_reason: "sick", notes: "", sets: [] },
		})
	})

	it("rejects non-object payloads and unknown statuses", () => {
		expect(parseSessionPayload(null, TODAY).ok).toBe(false)
		expect(parseSessionPayload({ ...valid, status: "done" }, TODAY).ok).toBe(
			false,
		)
	})

	it("rejects invalid, future and rest-day dates", () => {
		expect(
			parseSessionPayload({ ...valid, date: "2026-02-30" }, TODAY).ok,
		).toBe(false)
		expect(
			parseSessionPayload({ ...valid, date: "2026-08-20" }, TODAY).ok,
		).toBe(false)
		// 2026-08-16 is a Sunday.
		expect(
			parseSessionPayload({ ...valid, date: "2026-08-16" }, TODAY).ok,
		).toBe(false)
	})

	it("ties skip reasons to skipped sessions, both ways", () => {
		expect(
			parseSessionPayload({ date: "2026-08-18", status: "skipped" }, TODAY).ok,
		).toBe(false)
		expect(
			parseSessionPayload(
				{ date: "2026-08-18", status: "skipped", skip_reason: "bored" },
				TODAY,
			).ok,
		).toBe(false)
		expect(
			parseSessionPayload({ ...valid, skip_reason: "sick" }, TODAY).ok,
		).toBe(false)
	})

	it("rejects sets on a skipped session", () => {
		const result = parseSessionPayload(
			{
				date: "2026-08-18",
				status: "skipped",
				skip_reason: "lazy",
				sets: [{ exercise: "squat", weight_kg: 80, reps: 5 }],
			},
			TODAY,
		)
		expect(result.ok).toBe(false)
	})

	it("rejects malformed sets", () => {
		const withSet = (set: unknown) =>
			parseSessionPayload({ ...valid, sets: [set] }, TODAY)
		expect(withSet({ exercise: "curl", reps: 5 }).ok).toBe(false)
		expect(withSet({ exercise: "squat", reps: 0 }).ok).toBe(false)
		expect(withSet({ exercise: "squat", reps: 2.5 }).ok).toBe(false)
		expect(withSet({ exercise: "squat", weight_kg: -10, reps: 5 }).ok).toBe(
			false,
		)
		expect(withSet({ exercise: "squat", weight_kg: "80", reps: 5 }).ok).toBe(
			false,
		)
	})

	it("defaults notes to empty and caps their length", () => {
		const result = parseSessionPayload(
			{ date: "2026-08-17", status: "completed" },
			TODAY,
		)
		expect(result).toMatchObject({ ok: true, session: { notes: "", sets: [] } })
		expect(parseSessionPayload({ ...valid, notes: null }, TODAY)).toMatchObject(
			{
				ok: true,
				session: { notes: "" },
			},
		)
		expect(
			parseSessionPayload({ ...valid, notes: "x".repeat(2001) }, TODAY).ok,
		).toBe(false)
	})
})
