// @vitest-environment node
import { describe, it, expect } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import TabPanel from "../../src/components/typography/TabPanel.astro"

describe("TabPanel", () => {
	function fillSlots(tabs: string[]) {
		return Object.fromEntries(
			tabs.map((_, index) => [`tab-${index}`, `<p>Panel ${index}</p>`]),
		)
	}

	async function renderTabPanel(
		props: { tabs: string[]; groupLabel: string },
		slots?: Record<string, string>,
	) {
		const container = await AstroContainer.create()
		return container.renderToString(TabPanel, {
			props,
			slots: slots ?? fillSlots(props.tabs),
		})
	}

	function groupNames(html: string) {
		return [...html.matchAll(/<input[^>]*\bname="([^"]+)"/g)].map((m) => m[1])
	}

	function panels(html: string) {
		return html.match(/<div class="panel"[^>]*>.*?<\/div>/gs) ?? []
	}

	it("renders one radio per tab label", async () => {
		const html = await renderTabPanel({
			tabs: ["First", "Second", "Third"],
			groupLabel: "Prompt variants",
		})
		expect(groupNames(html)).toHaveLength(3)
		expect(html).toContain("First")
		expect(html).toContain("Second")
		expect(html).toContain("Third")
	})

	it("puts every radio of one instance in the same group", async () => {
		const html = await renderTabPanel({
			tabs: ["First", "Second", "Third"],
			groupLabel: "Prompt variants",
		})
		expect(new Set(groupNames(html)).size).toBe(1)
	})

	it("checks the first tab only", async () => {
		const html = await renderTabPanel({
			tabs: ["First", "Second", "Third"],
			groupLabel: "Prompt variants",
		})
		const inputs = html.match(/<input[^>]*>/g) ?? []
		expect(inputs).toHaveLength(3)
		expect(inputs[0]).toContain("checked")
		expect(inputs[1]).not.toContain("checked")
		expect(inputs[2]).not.toContain("checked")
	})

	it("gives distinct group names to two instances on the same page", async () => {
		const props = { tabs: ["First", "Second"], groupLabel: "Prompt variants" }
		const [first, second] = await Promise.all([
			renderTabPanel(props),
			renderTabPanel(props),
		])
		expect(groupNames(first)[0]).not.toBe(groupNames(second)[0])
	})

	it("renders slot content in the panel matching its tab index", async () => {
		const html = await renderTabPanel(
			{ tabs: ["First", "Second"], groupLabel: "Prompt variants" },
			{
				"tab-0": "<p>Content of the first panel</p>",
				"tab-1": "<p>Content of the second panel</p>",
			},
		)
		expect(panels(html)).toHaveLength(2)
		expect(panels(html)[0]).toContain("Content of the first panel")
		expect(panels(html)[0]).not.toContain("Content of the second panel")
		expect(panels(html)[1]).toContain("Content of the second panel")
		expect(panels(html)[1]).not.toContain("Content of the first panel")
	})

	it("exposes the label as the radio group's accessible name", async () => {
		const html = await renderTabPanel({
			tabs: ["First"],
			groupLabel: "Prompt variants",
		})
		expect(html).toContain('role="radiogroup"')
		expect(html).toContain('aria-label="Prompt variants"')
	})

	it("renders an empty group when there are no tabs", async () => {
		const html = await renderTabPanel({
			tabs: [],
			groupLabel: "Prompt variants",
		})
		expect(html).toContain("<tab-panel")
		expect(html).not.toContain("<input")
		expect(html).not.toContain('class="panel"')
	})

	it("fails the build when a tab has no content", async () => {
		await expect(
			renderTabPanel(
				{ tabs: ["First", "Second"], groupLabel: "Prompt variants" },
				{ "tab-O": "<p>letter O, not zero</p>", "tab-1": "<p>second</p>" },
			),
		).rejects.toThrow("tab-0")
	})

	it("fails the build when the only child forgot its slot attribute", async () => {
		// Only the missing-slot guard catches this. Unslotted content alongside
		// complete slots is dropped silently: MDX leaves whitespace in `default`
		// between fragments, so guarding it would reject valid usage.
		await expect(
			renderTabPanel(
				{ tabs: ["First"], groupLabel: "Prompt variants" },
				{ default: "<p>forgot the slot attribute</p>" },
			),
		).rejects.toThrow("no content for tab-0")
	})

	it("fails the build when a slot has no tab to render into", async () => {
		await expect(
			renderTabPanel(
				{ tabs: ["First", "Second"], groupLabel: "Prompt variants" },
				{
					"tab-0": "<p>first</p>",
					"tab-1": "<p>second</p>",
					"tab-2": "<p>third, never declared</p>",
				},
			),
		).rejects.toThrow("tab-2")
	})
})
