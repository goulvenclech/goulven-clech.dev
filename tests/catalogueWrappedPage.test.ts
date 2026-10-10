// @vitest-environment node
import {
	describe,
	it,
	expect,
	vi,
	beforeAll,
	afterAll,
	afterEach,
} from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import { createClient, type Client } from "@libsql/client"

let client: Client
vi.mock("$src/db", () => ({ getClient: () => client }))

beforeAll(async () => {
	client = createClient({ url: ":memory:" })
	await client.batch([
		`CREATE TABLE reviews (
			id INTEGER PRIMARY KEY,
			inserted_at TEXT,
			source TEXT,
			source_name TEXT,
			source_img TEXT,
			source_link TEXT,
			rating INTEGER,
			emotions TEXT,
			comment TEXT
		)`,
		`CREATE TABLE emotions (
			id INTEGER PRIMARY KEY,
			emoji TEXT,
			name TEXT,
			is_deleted BOOLEAN DEFAULT false
		)`,
		`INSERT INTO emotions (id, emoji, name) VALUES (1, 'J', 'joy')`,
		`INSERT INTO reviews (inserted_at, source, source_name, source_img, source_link, rating, emotions) VALUES
			('2025-03-01T00:00:00.000Z', 'IGDB', 'Outer Wilds', 'i', 'l', 6, '[1]'),
			('2025-04-01T00:00:00.000Z', 'OPENLIBRARY', 'Backdated Book', 'i', 'l', 6, '[1]'),
			('2026-03-01T00:00:00.000Z', 'IGDB', 'Hades II', 'i', 'l', 5, '[1]'),
			('2026-04-01T00:00:00.000Z', 'OPENLIBRARY', 'Dune', 'i', 'l', 6, '[1]')`,
	])
})

afterAll(() => client.close())

afterEach(() => {
	vi.useRealTimers()
})

async function renderYear(year: number) {
	const { default: WrappedPage } =
		await import("../src/pages/catalogue/wrapped/[year].astro")
	const container = await AstroContainer.create()
	return container.renderToString(WrappedPage, { props: { year } })
}

describe("catalogue wrapped page", () => {
	it("has no books section, nor Open Library credit, in 2025", async () => {
		const html = await renderYear(2025)
		expect(html).toContain("<strong>1 review</strong>")
		expect(html).toContain("Outer Wilds")
		expect(html).not.toContain("Books</h2>")
		expect(html).not.toContain("Backdated Book")
		expect(html).not.toContain("openlibrary.org")
	})

	it("adds the books section and its credit from 2026", async () => {
		const html = await renderYear(2026)
		expect(html).toContain("<strong>2 reviews</strong>")
		expect(html).toMatch(/1 Book<\/h2>/)
		expect(html).toContain("Dune")
		expect(html).toContain('href="https://openlibrary.org/"')
	})

	it("draws the year's emotions once", async () => {
		const html = await renderYear(2026)
		expect(html.match(/class="top-emotions-chart"/g)).toHaveLength(1)
		expect(html).toMatch(
			/<figcaption[^>]*>The emotions I tagged most in 2026\.<\/figcaption>/,
		)
		expect(html).toMatch(/class="row-label"[^>]*>J joy</)
	})

	it("leaves the emotion chart out of a year without repeated emotions", async () => {
		const html = await renderYear(2025)
		expect(html).not.toContain("top-emotions-chart")
		expect(html).not.toContain("The emotions I tagged most in 2025.")
	})

	it("only renders sections with reviews", async () => {
		const html = await renderYear(2026)
		expect(html).toMatch(/1 Video game<\/h2>/)
		expect(html).not.toContain("Board games</h2>")
	})

	it("links the other open years, not its own", async () => {
		vi.useFakeTimers({ toFake: ["Date"] })
		vi.setSystemTime(new Date("2027-02-01T00:00:00.000Z"))
		const html = await renderYear(2026)
		expect(html).toContain('href="/catalogue/wrapped/2025"')
		expect(html).not.toContain('href="/catalogue/wrapped/2026"')
		expect(html).toContain('aria-current="page">2026<')
	})
})

describe("catalogue wrapped index", () => {
	it("redirects to the latest open year", async () => {
		vi.useFakeTimers({ toFake: ["Date"] })
		vi.setSystemTime(new Date("2027-02-01T00:00:00.000Z"))
		const { default: WrappedIndex } =
			await import("../src/pages/catalogue/wrapped/index.astro")
		const container = await AstroContainer.create()
		const response = await container.renderToResponse(WrappedIndex)
		expect(response.status).toBe(307)
		expect(response.headers.get("Location")).toBe("/catalogue/wrapped/2026")
	})
})
