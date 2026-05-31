import { describe, it, expect, vi } from "vitest"

const { BLOG_FIXTURES } = vi.hoisted(() => ({
	BLOG_FIXTURES: [
		{
			id: "2024/past",
			data: {
				title: "Past Release Post",
				abstract: "Shipped a while ago",
				date: new Date("2024-01-01"),
				published: "1.8.0",
			},
		},
		{
			id: "2025/current",
			data: {
				title: "Current Release Post",
				abstract: "Shipped at the current version",
				date: new Date("2025-03-01"),
				published: "1.9.0", // current version; gate is inclusive
			},
		},
		{
			id: "2025/mid",
			data: {
				title: "Mid Release Post",
				abstract: "Shipped between the other two",
				date: new Date("2025-01-15"),
				published: "1.8.5",
			},
		},
		{
			id: "2025/future",
			data: {
				title: "Future Version Post",
				abstract: "Scheduled for a later release",
				date: new Date("2025-06-01"),
				published: "1.10.0",
			},
		},
		{
			id: "2025/draft",
			data: {
				title: "Draft Post",
				abstract: "Work in progress",
				date: new Date("2025-04-01"),
				published: "draft",
			},
		},
		{
			id: "2025/never",
			data: {
				title: "Never Post",
				abstract: "Hidden everywhere",
				date: new Date("2025-05-01"),
				published: "never",
			},
		},
	],
}))

// Apply the filter callback like Astro does, so the real publication gating runs.
vi.mock("astro:content", () => ({
	getCollection: vi.fn(
		async (
			collection: string,
			filter?: (entry: { data: { published: string } }) => boolean,
		) =>
			collection === "blog"
				? filter
					? BLOG_FIXTURES.filter(filter)
					: BLOG_FIXTURES
				: [],
	),
}))

import { GET } from "../src/pages/feed.xml"
import { createEndpointContext } from "./helpers"

describe("feed.xml GET", () => {
	it("includes only published entries, never drafts/never/future versions", async () => {
		const res = await GET(createEndpointContext("/feed.xml"))
		expect(res.status).toBe(200)
		const xml = await res.text()

		expect(xml).toContain("Past Release Post")
		expect(xml).toContain("Current Release Post")
		expect(xml).toContain("http://localhost:4321/2024/past")

		expect(xml).not.toContain("Draft Post")
		expect(xml).not.toContain("Never Post")
		expect(xml).not.toContain("Future Version Post")
	})

	it("orders entries newest first", async () => {
		const xml = await (await GET(createEndpointContext("/feed.xml"))).text()
		// Survivors are not in date order in the fixtures, so the sort must run.
		expect(xml.indexOf("Current Release Post")).toBeLessThan(
			xml.indexOf("Mid Release Post"),
		)
		expect(xml.indexOf("Mid Release Post")).toBeLessThan(
			xml.indexOf("Past Release Post"),
		)
	})
})
