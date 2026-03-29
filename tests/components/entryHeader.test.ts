// @vitest-environment node
import { describe, it, expect } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import EntryHeader from "../../src/components/EntryHeader.astro"

describe("EntryHeader", () => {
	function defaultProps() {
		return {
			title: "My Test Article",
			abstract: "A <em>brief</em> abstract.",
			date: new Date("2025-04-01T00:00:00Z"),
			isAprilCools: false,
			isPublished: true,
			timeMachine: undefined as string | undefined,
		}
	}

	async function renderHeader(
		overrides: Partial<ReturnType<typeof defaultProps>> = {},
	) {
		const container = await AstroContainer.create()
		return container.renderToString(EntryHeader, {
			props: { ...defaultProps(), ...overrides },
		})
	}

	it("renders the title in an h1", async () => {
		const html = await renderHeader({ title: "Hello World" })
		expect(html).toContain("<h1>Hello World</h1>")
	})

	it("renders the abstract with inline HTML", async () => {
		const html = await renderHeader({ abstract: "A <em>brief</em> abstract." })
		expect(html).toContain("A <em>brief</em> abstract.")
	})

	it("renders the formatted date", async () => {
		const html = await renderHeader({ date: new Date("2025-01-18T00:00:00Z") })
		expect(html).toContain("18 January 2025")
	})

	it("renders the author link", async () => {
		const html = await renderHeader()
		expect(html).toContain(`<a href="/">Goulven CLEC'H</a>`)
	})

	it("shows April Cools message inline with abstract when isAprilCools is true", async () => {
		const html = await renderHeader({
			isAprilCools: true,
			abstract: "A <em>brief</em> abstract.",
		})
		expect(html).toContain("This is an")
		expect(html).toContain("April Cools'")
		expect(html).toContain('href="https://www.aprilcools.club/"')
		// April Cools message is inside the same <p> as the abstract
		const paragraphs = html.match(/<p[^>]*>.*?<\/p>/gs) ?? []
		const abstractParagraph = paragraphs.find((p: string) =>
			p.includes("brief"),
		)
		expect(abstractParagraph).toContain("April Cools'")
	})

	it("does not show April Cools message when isAprilCools is false", async () => {
		const html = await renderHeader({ isAprilCools: false })
		expect(html).not.toContain("April Cools")
		expect(html).not.toContain("aprilcools.club")
	})

	it("shows draft warning when isPublished is false", async () => {
		const html = await renderHeader({ isPublished: false })
		expect(html).toContain("<warning-note")
		expect(html).toContain("work-in-progress draft")
	})

	it("does not show draft warning when isPublished is true", async () => {
		const html = await renderHeader({ isPublished: true })
		expect(html).not.toContain("<warning-note")
		expect(html).not.toContain("work-in-progress draft")
	})

	it("shows time machine message inline with abstract when timeMachine is set", async () => {
		const html = await renderHeader({
			abstract: "A <em>brief</em> abstract.",
			timeMachine: "Originally written in 2019",
		})
		expect(html).toContain("Originally written in 2019")
		expect(html).not.toContain("<time-machine")
		// Time machine message is inside the same <p> as the abstract
		const paragraphs = html.match(/<p[^>]*>.*?<\/p>/gs) ?? []
		const abstractParagraph = paragraphs.find((p: string) =>
			p.includes("brief"),
		)
		expect(abstractParagraph).toContain("Originally written in 2019")
	})

	it("does not show time machine message when timeMachine is undefined", async () => {
		const html = await renderHeader({ timeMachine: undefined })
		expect(html).not.toContain("time machine")
		expect(html).not.toContain("<time-machine")
	})

	it("shows both April Cools and time machine messages when both are set", async () => {
		const html = await renderHeader({
			abstract: "A <em>brief</em> abstract.",
			isAprilCools: true,
			timeMachine: "Originally written in 2019",
		})
		const paragraphs = html.match(/<p[^>]*>.*?<\/p>/gs) ?? []
		const abstractParagraph = paragraphs.find((p: string) =>
			p.includes("brief"),
		)
		expect(abstractParagraph).toContain("April Cools'")
		expect(abstractParagraph).toContain("Originally written in 2019")
	})
})
