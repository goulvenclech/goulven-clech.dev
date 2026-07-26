/**
 * The shapes the catalogue's API serves, kept out of the route modules so
 * browser code can import them without reaching into src/pages.
 */

/**
 * A review helps me keep track of my feelings about a book, movie, or other media.
 */
export interface Review {
	id: number
	source: string
	source_id: string
	source_name: string
	source_link: string
	source_img: string
	rating: number // 1-6
	emotions: number[] // Emotion IDs
	comment: string
	inserted_at: string // ISO-8601
	meta: string
}

/**
 * The API omits soft-deleted emotions, so an old review can carry an id that is
 * no longer in the list.
 */
export interface Emotion {
	id: number
	emoji: string
	name: string
}
