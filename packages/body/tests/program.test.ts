import { describe, expect, it } from "vitest"
import { exerciseBySlug, programFor } from "$src/program"

describe("programFor", () => {
	it("schedules gym strength on Monday and Friday", () => {
		expect(programFor("2026-08-17")).toMatchObject({
			kind: "strength",
			location: "gym",
		})
		expect(programFor("2026-08-21")).toMatchObject({
			kind: "strength",
			location: "gym",
		})
	})

	it("schedules home sessions midweek and rest on Sunday", () => {
		expect(programFor("2026-08-18")).toMatchObject({
			kind: "cardio",
			location: "home",
		})
		expect(programFor("2026-08-19")).toMatchObject({ kind: "combat" })
		expect(programFor("2026-08-20")).toMatchObject({ kind: "core" })
		expect(programFor("2026-08-23")).toMatchObject({
			kind: "rest",
			location: null,
		})
	})
})

describe("exerciseBySlug", () => {
	it("resolves a known slug and returns null otherwise", () => {
		expect(exerciseBySlug("squat")).toMatchObject({
			pattern: "squat",
			main: true,
		})
		expect(exerciseBySlug("curl")).toBeNull()
	})
})
