import type { Client } from "$src/db"
import {
	parseEmotionIds,
	reviewDetailText,
	SOURCE_ORDER,
	sourcePlurals,
	sourceSingulars,
	type MediaSource,
	type ReviewThumbnail,
} from "$src/catalogue/reviewUtils"

export const FIRST_WRAPPED_YEAR = 2025

const SOURCE_FIRST_YEAR: Partial<Record<MediaSource, number>> = {
	OPENLIBRARY: 2026,
}

const OCTOBER = 9

export function wrappedYears(
	now = new Date(),
	preview = import.meta.env.DEV,
): number[] {
	const years: number[] = []
	for (let year = FIRST_WRAPPED_YEAR; year <= now.getUTCFullYear(); year++) {
		const opensAt = preview
			? Date.UTC(year, OCTOBER, 1)
			: Date.UTC(year + 1, 0, 1)
		if (now.getTime() >= opensAt) years.push(year)
	}
	return years
}

export function wrappedSources(year: number): MediaSource[] {
	return SOURCE_ORDER.filter(
		(source) => (SOURCE_FIRST_YEAR[source] ?? FIRST_WRAPPED_YEAR) <= year,
	)
}

export interface WrappedReview {
	id: number
	source: string
	source_name: string
	source_img: string
	source_link: string
	rating: number
	emotions: string
	comment: string | null
	inserted_at: string
}

export interface WrappedEmotion {
	id: number
	emoji: string
	name: string
}

export interface EmotionTally extends WrappedEmotion {
	count: number
}

export interface RatingStats {
	total: number
	favorites: number
	loved: number
	liked: number
}

export interface WrappedSection {
	source: MediaSource
	heading: string
	stats: RatingStats
	topEmotions: EmotionTally[]
	highlights: ReviewThumbnail[]
}

export interface WrappedYear {
	year: number
	stats: RatingStats
	topEmotions: EmotionTally[]
	sections: WrappedSection[]
}

const OVERVIEW_EMOTION_COUNT = 10
const SECTION_EMOTION_COUNT = 3
const HIGHLIGHT_MIN_RATING = 4

function tallyRatings(reviews: WrappedReview[]): RatingStats {
	const count = (rating: number) =>
		reviews.filter((review) => review.rating === rating).length
	return {
		total: reviews.length,
		favorites: count(6),
		loved: count(5),
		liked: count(4),
	}
}

/** Ties go to the newest emotion, as the first published wrap ordered them. */
function tallyTopEmotions(
	reviews: WrappedReview[],
	emotionsById: Map<number, WrappedEmotion>,
	limit: number,
): EmotionTally[] {
	const counts = new Map<number, number>()
	for (const review of reviews)
		for (const id of parseEmotionIds(review.emotions))
			counts.set(id, (counts.get(id) ?? 0) + 1)

	return [...counts]
		.flatMap(([id, count]) => {
			const emotion = emotionsById.get(id)
			return emotion && count > 1 ? [{ ...emotion, count }] : []
		})
		.sort((a, b) => b.count - a.count || b.id - a.id)
		.slice(0, limit)
}

function highlights(
	reviews: WrappedReview[],
	emotionsById: Map<number, WrappedEmotion>,
): ReviewThumbnail[] {
	return reviews
		.filter((review) => review.rating >= HIGHLIGHT_MIN_RATING)
		.sort(
			(a, b) =>
				b.rating - a.rating ||
				b.inserted_at.localeCompare(a.inserted_at) ||
				b.id - a.id,
		)
		.map((review) => ({
			source_name: review.source_name,
			source_img: review.source_img,
			source_link: review.source_link,
			rating: review.rating,
			detail: reviewDetailText(review, emotionsById),
		}))
}

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1)
}

export function buildWrappedYear(
	year: number,
	reviews: WrappedReview[],
	emotions: WrappedEmotion[],
): WrappedYear {
	const emotionsById = new Map(emotions.map((emotion) => [emotion.id, emotion]))
	const sources = wrappedSources(year)
	const covered = new Set<string>(sources)
	const counted = reviews.filter((review) => covered.has(review.source))

	const sections = sources
		.map((source) => {
			const own = counted.filter((review) => review.source === source)
			return {
				source,
				heading: formatCount(
					own.length,
					capitalize(sourceSingulars[source]),
					capitalize(sourcePlurals[source]),
				),
				stats: tallyRatings(own),
				topEmotions: tallyTopEmotions(own, emotionsById, SECTION_EMOTION_COUNT),
				highlights: highlights(own, emotionsById),
			}
		})
		.filter((section) => section.stats.total > 0)

	return {
		year,
		stats: tallyRatings(counted),
		topEmotions: tallyTopEmotions(
			counted,
			emotionsById,
			OVERVIEW_EMOTION_COUNT,
		),
		sections,
	}
}

export async function fetchWrappedReviews(
	client: Client,
	year: number,
): Promise<WrappedReview[]> {
	const result = await client.execute({
		sql: `SELECT id, source, source_name, source_img, source_link, rating, emotions, comment, inserted_at
		        FROM reviews
		       WHERE inserted_at >= ? AND inserted_at < ?`,
		args: [`${year}-01-01T00:00:00.000Z`, `${year + 1}-01-01T00:00:00.000Z`],
	})
	return result.rows as unknown as WrappedReview[]
}

async function fetchEmotions(client: Client): Promise<WrappedEmotion[]> {
	const result = await client.execute(
		"SELECT id, emoji, name FROM emotions WHERE is_deleted = false",
	)
	return (
		result.rows as unknown as { id: number; emoji: string; name: string }[]
	).map((row) => ({ id: Number(row.id), emoji: row.emoji, name: row.name }))
}

export async function loadWrappedYear(
	client: Client,
	year: number,
): Promise<WrappedYear> {
	const [reviews, emotions] = await Promise.all([
		fetchWrappedReviews(client, year),
		fetchEmotions(client),
	])
	return buildWrappedYear(year, reviews, emotions)
}

export function formatCount(
	count: number,
	singular: string,
	plural: string,
): string {
	return `${count} ${count === 1 ? singular : plural}`
}

const conjunction = new Intl.ListFormat("en", { type: "conjunction" })

export function formatRatingBreakdown(stats: RatingStats): string {
	const parts: string[] = []
	if (stats.favorites > 0)
		parts.push(
			`${stats.favorites} favorite${stats.favorites > 1 ? "s" : ""} ⭐`,
		)
	if (stats.loved > 0) parts.push(`${stats.loved} loved 😍`)
	if (stats.liked > 0) parts.push(`${stats.liked} liked 😀`)
	return conjunction.format(parts)
}

/** A section's blurb, as HTML. */
export function formatSectionSummary(
	stats: RatingStats,
	emotions: EmotionTally[],
): string {
	const breakdown = formatRatingBreakdown(stats)
	const felt = conjunction.format(emotions.map(({ name }) => `<i>${name}</i>`))
	if (breakdown && felt)
		return `Including ${breakdown}. And mostly felt ${felt}.`
	if (breakdown) return `Including ${breakdown}.`
	if (felt) return `Mostly felt ${felt}.`
	return ""
}
