// @vitest-environment node
import { describe, it, expect } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import ChangelogCard from "../../src/components/changelog/ChangelogCard.astro"
import Asterism from "../../src/components/typography/Asterism.astro"

async function renderCard(overrides: Record<string, unknown> = {}) {
	const entry = {
		date: new Date("2024-07-04"),
		name: "Drop caps",
		description: "Entries now open with a <em>large</em> initial letter ☞",
		...overrides,
	}
	const container = await AstroContainer.create()
	return container.renderToString(ChangelogCard, { props: { entry } })
}

describe("ChangelogCard", () => {
	it("labels the entry with its name and renders its HTML description", async () => {
		const html = await renderCard()
		expect(html).toContain("<strong>Drop caps:</strong>")
		expect(html).toContain(
			"Entries now open with a <em>large</em> initial letter ☞",
		)
	})

	it("links to the entry's url with its caption", async () => {
		const html = await renderCard({
			url: "/2023/launching-blog-astro",
			url_caption: "See an example.",
		})
		expect(html).toContain(
			'<a href="/2023/launching-blog-astro">See an example.</a>',
		)
	})

	it("strikes a deprecated entry through", async () => {
		const html = await renderCard({ is_deprecated: true })
		expect(html).toMatch(/<s>\s*<strong>Drop caps:<\/strong>/)
	})

	it("does not strike an entry through unless it is deprecated", async () => {
		expect(await renderCard()).not.toContain("<s>")
		expect(await renderCard({ is_deprecated: false })).not.toContain("<s>")
	})

	it("renders the entry's own content after its description", async () => {
		const html = await renderCard({
			render: async () => ({ Content: Asterism }),
		})
		expect(html.indexOf("⁂")).toBeGreaterThan(html.indexOf("initial letter"))
	})
})
