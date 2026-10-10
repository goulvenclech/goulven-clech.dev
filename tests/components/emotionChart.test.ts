// @vitest-environment node
import { describe, expect, it } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import EmotionChart from "../../src/components/catalogue/EmotionChart.astro"
import type { EmotionTally } from "../../src/catalogue/wrapped"

const emotion = (name: string, count: number, emoji = "😐"): EmotionTally => ({
	id: count,
	emoji,
	name,
	count,
})

async function render(emotions: EmotionTally[]) {
	const container = await AstroContainer.create()
	return container.renderToString(EmotionChart, {
		props: { emotions, caption: "The emotions I tagged most in 2026." },
	})
}

const textOf = (html: string, className: string) =>
	[...html.matchAll(new RegExp(`class="${className}"[^>]*>([^<]*)<`, "g"))].map(
		([, text]) => text.trim(),
	)

const barWidths = (html: string) =>
	[...html.matchAll(/class="bar"[^>]*style="width:([\d.]+)%"/g)].map(
		([, width]) => Number(width),
	)

describe("EmotionChart", () => {
	it("lists each emotion in order, by emoji and name", async () => {
		const html = await render([
			emotion("bored", 28, "🥱"),
			emotion("amused", 15, "🤣"),
		])
		expect(textOf(html, "row-label")).toEqual(["🥱 bored", "🤣 amused"])
	})

	it("sizes bars against the most frequent emotion", async () => {
		const html = await render([emotion("bored", 28), emotion("amused", 7)])
		expect(barWidths(html)).toEqual([100, 25])
	})

	it("keeps counts outside the bars", async () => {
		const counts = [30, 5, 2]
		const html = await render(
			counts.map((count) => emotion(`e${count}`, count)),
		)
		const barContents = [
			...html.matchAll(/<div class="bar"[^>]*>(.*?)<\/div>/gs),
		].map(([, content]) => content.trim())
		expect(barContents).toEqual(counts.map(() => ""))
		expect(textOf(html, "row-count")).toEqual(counts.map(String))
	})

	it("names the emotion and its review count in each tooltip", async () => {
		const html = await render([emotion("bored", 28)])
		expect(html).toContain('data-tooltip="bored: 28 reviews"')
	})

	it("captions the chart and backs it with a table of the numbers", async () => {
		const html = await render([
			emotion("bored", 28, "🥱"),
			emotion("amused", 15, "🤣"),
		])
		expect(html).toMatch(
			/<figcaption[^>]*>The emotions I tagged most in 2026\.<\/figcaption>/,
		)
		expect(html).toMatch(
			/<th scope="row"[^>]*>🥱 bored<\/th>\s*<td[^>]*>28<\/td>/,
		)
		expect(html).toMatch(
			/<th scope="row"[^>]*>🤣 amused<\/th>\s*<td[^>]*>15<\/td>/,
		)
	})
})
