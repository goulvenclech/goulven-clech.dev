import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type Client } from "@libsql/client"
import {
	buildWrappedYear,
	fetchWrappedReviews,
	formatRatingBreakdown,
	formatSectionSummary,
	loadWrappedYear,
	wrappedSources,
	wrappedYears,
	type EmotionTally,
	type RatingStats,
	type WrappedEmotion,
	type WrappedReview,
} from "../src/catalogue/wrapped"

const at = (iso: string) => new Date(iso)

describe("wrappedYears", () => {
	it("publishes a year from the first of January after it, UTC", () => {
		expect(wrappedYears(at("2025-12-31T23:59:59.999Z"), false)).toEqual([])
		expect(wrappedYears(at("2026-01-01T00:00:00.000Z"), false)).toEqual([2025])
	})

	it("keeps the running year out of the build until it is over", () => {
		expect(wrappedYears(at("2026-12-31T23:59:59.999Z"), false)).toEqual([2025])
		expect(wrappedYears(at("2027-01-01T00:00:00.000Z"), false)).toEqual([
			2025, 2026,
		])
	})

	it("previews the running year from the first of October", () => {
		expect(wrappedYears(at("2026-09-30T23:59:59.999Z"), true)).toEqual([2025])
		expect(wrappedYears(at("2026-10-01T00:00:00.000Z"), true)).toEqual([
			2025, 2026,
		])
	})

	it("lists every past year, oldest first", () => {
		expect(wrappedYears(at("2028-06-15T12:00:00.000Z"), false)).toEqual([
			2025, 2026, 2027,
		])
	})

	it("has nothing before the first wrap", () => {
		expect(wrappedYears(at("2024-12-01T00:00:00.000Z"), true)).toEqual([])
	})
})

describe("wrappedSources", () => {
	it("leaves books out before the catalogue tracked them", () => {
		expect(wrappedSources(2025)).toEqual([
			"IGDB",
			"BGG",
			"TMDB_MOVIE",
			"TMDB_TV",
			"SPOTIFY",
		])
	})

	it("adds books, last, from 2026 on", () => {
		expect(wrappedSources(2026).at(-1)).toBe("OPENLIBRARY")
		expect(wrappedSources(2027)).toContain("OPENLIBRARY")
	})
})

const EMOTIONS: WrappedEmotion[] = [
	{ id: 1, emoji: "😊", name: "joy" },
	{ id: 2, emoji: "😢", name: "sadness" },
	{ id: 3, emoji: "😨", name: "fear" },
	{ id: 4, emoji: "😮", name: "awe" },
]

let nextId = 1
function review(overrides: Partial<WrappedReview> = {}): WrappedReview {
	const id = nextId++
	return {
		id,
		source: "IGDB",
		source_name: `Game ${id}`,
		source_img: `https://example.com/${id}.jpg`,
		source_link: `https://example.com/${id}`,
		rating: 4,
		emotions: "[]",
		comment: null,
		inserted_at: "2026-03-01T10:00:00.000Z",
		...overrides,
	}
}

describe("buildWrappedYear", () => {
	it("leaves books out of 2025, overview included", () => {
		const wrap = buildWrappedYear(
			2025,
			[review({ rating: 6 }), review({ source: "OPENLIBRARY", rating: 6 })],
			EMOTIONS,
		)
		expect(wrap.sections.map((section) => section.source)).toEqual(["IGDB"])
		expect(wrap.stats.total).toBe(1)
	})

	it("gives books their own section from 2026 on", () => {
		const wrap = buildWrappedYear(
			2026,
			[review(), review({ source: "OPENLIBRARY" })],
			EMOTIONS,
		)
		expect(wrap.sections.map((section) => section.source)).toEqual([
			"IGDB",
			"OPENLIBRARY",
		])
		expect(wrap.stats.total).toBe(2)
	})

	it("drops sources without a single review that year", () => {
		const wrap = buildWrappedYear(
			2026,
			[review({ source: "BGG" }), review({ source: "SPOTIFY" })],
			EMOTIONS,
		)
		expect(wrap.sections.map((section) => section.source)).toEqual([
			"BGG",
			"SPOTIFY",
		])
	})

	it("heads each section with its count, singular for one", () => {
		const wrap = buildWrappedYear(
			2026,
			[review(), review(), review({ source: "OPENLIBRARY" })],
			EMOTIONS,
		)
		expect(wrap.sections.map((section) => section.heading)).toEqual([
			"2 Video games",
			"1 Book",
		])
	})

	it("tallies every rating, and favorites, loves, and likes apart", () => {
		const wrap = buildWrappedYear(
			2026,
			[1, 3, 4, 4, 5, 6, 6, 6].map((rating) => review({ rating })),
			EMOTIONS,
		)
		const expected: RatingStats = { total: 8, favorites: 3, loved: 1, liked: 2 }
		expect(wrap.stats).toEqual(expected)
		expect(wrap.sections[0].stats).toEqual(expected)
	})

	it("ranks emotions felt more than once, most frequent then newest first", () => {
		const wrap = buildWrappedYear(
			2026,
			[
				review({ emotions: "[1,2,3]" }),
				review({ emotions: "[1,2,3]" }),
				review({ emotions: "[2,4]" }),
			],
			EMOTIONS,
		)
		expect(wrap.topEmotions).toEqual([
			{ id: 2, emoji: "😢", name: "sadness", count: 3 },
			{ id: 3, emoji: "😨", name: "fear", count: 2 },
			{ id: 1, emoji: "😊", name: "joy", count: 2 },
		])
	})

	it("ignores emotions no longer listed, and malformed emotion lists", () => {
		const wrap = buildWrappedYear(
			2026,
			[
				review({ emotions: "[1,9]" }),
				review({ emotions: "[1,9]" }),
				review({ emotions: "not json" }),
			],
			EMOTIONS,
		)
		expect(wrap.topEmotions.map((emotion) => emotion.name)).toEqual(["joy"])
	})

	it("keeps three emotions per section and ten in the overview", () => {
		const emotions = Array.from({ length: 12 }, (_, index) => ({
			id: index + 1,
			emoji: "·",
			name: `emotion ${index + 1}`,
		}))
		const allTwice = JSON.stringify(emotions.map(({ id }) => id))
		const wrap = buildWrappedYear(
			2026,
			[review({ emotions: allTwice }), review({ emotions: allTwice })],
			emotions,
		)
		expect(wrap.topEmotions).toHaveLength(10)
		expect(wrap.sections[0].topEmotions).toHaveLength(3)
	})

	it("highlights liked-or-better reviews, best rated, then most recent, first", () => {
		const wrap = buildWrappedYear(
			2026,
			[
				review({ source_name: "Meh", rating: 3 }),
				review({
					source_name: "Old favorite",
					rating: 6,
					inserted_at: "2026-01-02T00:00:00.000Z",
				}),
				review({
					source_name: "Liked",
					rating: 4,
					inserted_at: "2026-12-30T00:00:00.000Z",
				}),
				review({
					source_name: "New favorite",
					rating: 6,
					inserted_at: "2026-06-01T00:00:00.000Z",
				}),
			],
			EMOTIONS,
		)
		expect(
			wrap.sections[0].highlights.map((highlight) => highlight.source_name),
		).toEqual(["New favorite", "Old favorite", "Liked"])
	})

	it("puts the review entered last first on a same-day tie", () => {
		const sameDay = { rating: 4, inserted_at: "2026-05-20T00:00:00.000Z" }
		const wrap = buildWrappedYear(
			2026,
			[
				review({ ...sameDay, id: 382, source_name: "Entered first" }),
				review({ ...sameDay, id: 383, source_name: "Entered second" }),
			],
			EMOTIONS,
		)
		expect(
			wrap.sections[0].highlights.map((highlight) => highlight.source_name),
		).toEqual(["Entered second", "Entered first"])
	})

	it("describes each highlight with its rating, emotions, and comment", () => {
		const wrap = buildWrappedYear(
			2026,
			[review({ rating: 5, emotions: "[1]", comment: "Lovely." })],
			EMOTIONS,
		)
		expect(wrap.sections[0].highlights[0].detail).toBe(
			"😍 loved this game, felt joy; « Lovely. »",
		)
	})
})

const stats = (overrides: Partial<RatingStats>): RatingStats => ({
	total: 10,
	favorites: 0,
	loved: 0,
	liked: 0,
	...overrides,
})

describe("formatRatingBreakdown", () => {
	it("lists favorites, loves, and likes", () => {
		expect(
			formatRatingBreakdown(stats({ favorites: 2, loved: 3, liked: 5 })),
		).toBe("2 favorites ⭐, 3 loved 😍, and 5 liked 😀")
	})

	it("joins two kinds without a dangling comma, and keeps a lone favorite singular", () => {
		expect(formatRatingBreakdown(stats({ favorites: 1, loved: 3 }))).toBe(
			"1 favorite ⭐ and 3 loved 😍",
		)
	})

	it("says likes alone without a leading 'and'", () => {
		expect(formatRatingBreakdown(stats({ liked: 5 }))).toBe("5 liked 😀")
	})

	it("is empty when nothing scored 4 or more", () => {
		expect(formatRatingBreakdown(stats({}))).toBe("")
	})
})

describe("formatSectionSummary", () => {
	const felt: EmotionTally[] = [
		{ id: 1, emoji: "😊", name: "joy", count: 4 },
		{ id: 4, emoji: "😮", name: "awe", count: 2 },
	]

	it("pairs the breakdown with the emotions felt", () => {
		expect(formatSectionSummary(stats({ loved: 3 }), felt)).toBe(
			"Including 3 loved 😍. And mostly felt <i>joy</i> and <i>awe</i>.",
		)
	})

	it("stands on the breakdown alone", () => {
		expect(formatSectionSummary(stats({ loved: 3 }), [])).toBe(
			"Including 3 loved 😍.",
		)
	})

	it("stands on the emotions alone", () => {
		expect(formatSectionSummary(stats({}), felt)).toBe(
			"Mostly felt <i>joy</i> and <i>awe</i>.",
		)
	})

	it("is empty when there's nothing to say", () => {
		expect(formatSectionSummary(stats({}), [])).toBe("")
	})
})

async function seededClient(statements: string[]): Promise<Client> {
	const client = createClient({ url: ":memory:" })
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
		...statements,
	])
	return client
}

describe("loading a year", () => {
	let client: Client

	beforeAll(async () => {
		client = await seededClient([
			`INSERT INTO emotions (id, emoji, name, is_deleted) VALUES
				(1, 'J', 'joy', false), (2, 'R', 'retired', true)`,
			`INSERT INTO reviews (inserted_at, source, source_name, source_img, source_link, rating, emotions, comment) VALUES
				('2024-12-31T23:59:59.999Z', 'IGDB', 'Last of 2024', 'i', 'l', 6, '[1,2]', NULL),
				('2025-01-01T00:00:00.000Z', 'IGDB', 'First of 2025', 'i', 'l', 6, '[1,2]', NULL),
				('2025-12-31T23:59:59.999Z', 'IGDB', 'Last of 2025', 'i', 'l', 5, '[1,2]', NULL),
				('2026-01-01T00:00:00.000Z', 'IGDB', 'First of 2026', 'i', 'l', 6, '[1,2]', NULL)`,
		])
	})

	afterAll(() => client.close())

	it("fetches the year's reviews, from the first of January up to the next, UTC", async () => {
		const reviews = await fetchWrappedReviews(client, 2025)
		expect(reviews.map((row) => row.source_name).sort()).toEqual([
			"First of 2025",
			"Last of 2025",
		])
	})

	it("tallies the year with its live emotions only", async () => {
		const wrap = await loadWrappedYear(client, 2025)
		expect(wrap.stats).toEqual({ total: 2, favorites: 1, loved: 1, liked: 0 })
		expect(wrap.topEmotions).toEqual([
			{ id: 1, emoji: "J", name: "joy", count: 2 },
		])
		expect(wrap.sections[0].highlights[0].detail).toBe(
			"⭐ favorite game, felt joy",
		)
	})
})

describe("loading same-day highlights", () => {
	let client: Client

	beforeAll(async () => {
		client = await seededClient([
			`INSERT INTO reviews (inserted_at, source, source_name, source_img, source_link, rating, emotions, comment) VALUES
				('2026-05-20T00:00:00.000Z', 'IGDB', 'Entered first', 'i', 'l', 4, '[]', NULL),
				('2026-05-20T00:00:00.000Z', 'IGDB', 'Entered second', 'i', 'l', 4, '[]', NULL)`,
		])
	})

	afterAll(() => client.close())

	it("fetches the ids that break the tie", async () => {
		const wrap = await loadWrappedYear(client, 2026)
		expect(
			wrap.sections[0].highlights.map((highlight) => highlight.source_name),
		).toEqual(["Entered second", "Entered first"])
	})
})
