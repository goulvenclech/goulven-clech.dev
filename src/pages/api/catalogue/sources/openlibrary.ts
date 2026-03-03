/**
 * Helpers to fetch Open Library book data.
 * Docs → https://openlibrary.org/developers/api
 */

export interface OpenLibraryBook {
	olid: string // Edition OLID e.g. "OL12345M"
	title: string
	authors: string[]
	publishers: string[]
	publishYear?: number
	subjects: string[]
	coverOlid?: string // OLID used for cover image
}

interface EditionResponse {
	title?: string
	publishers?: string[]
	publish_date?: string
	covers?: number[]
	works?: { key: string }[]
	authors?: { key?: string; author?: { key: string } }[]
}

interface WorkResponse {
	authors?: { author: { key: string } }[]
	subjects?: string[]
}

interface AuthorResponse {
	name?: string
}

const OL_HEADERS: HeadersInit = {
	"User-Agent": "MyCatalogue (nevilain@gmail.com)",
}

/**
 * Fetch a book edition by its OLID, then resolve authors from the work.
 */
export async function fetchBook(olid: string): Promise<OpenLibraryBook | null> {
	// Only edition OLIDs are accepted (e.g. OL28969077M)
	if (!/^OL\d+M$/i.test(olid)) return null

	const editionRes = await fetch(`https://openlibrary.org/books/${olid}.json`, {
		headers: OL_HEADERS,
	})
	if (!editionRes.ok) return null
	const edition = (await editionRes.json()) as EditionResponse

	// Resolve the work to get subjects and (fallback) authors
	const workKey = edition.works?.[0]?.key
	let work: WorkResponse | null = null
	if (workKey) {
		const workRes = await fetch(`https://openlibrary.org${workKey}.json`, {
			headers: OL_HEADERS,
		})
		if (workRes.ok) work = (await workRes.json()) as WorkResponse
	}

	// Resolve author names – prefer edition authors, fall back to work authors
	const editionAuthorKeys = edition.authors
		?.map((a) => a.key ?? a.author?.key)
		.filter((key): key is string => !!key)
	const workAuthorKeys = work?.authors
		?.map((a) => a.author?.key)
		.filter((key): key is string => !!key)
	const authorKeys = editionAuthorKeys?.length
		? editionAuthorKeys
		: (workAuthorKeys ?? [])

	const authors = await Promise.all(
		authorKeys.map(async (key) => {
			const res = await fetch(`https://openlibrary.org${key}.json`, {
				headers: OL_HEADERS,
			})
			if (!res.ok) return null
			const data = (await res.json()) as AuthorResponse
			return data.name ?? null
		}),
	)

	// Parse publish year from various date formats ("2020", "January 1, 2020", etc.)
	const yearMatch = edition.publish_date?.match(/\b(\d{4})\b/)
	const publishYear = yearMatch ? Number(yearMatch[1]) : undefined

	return {
		olid,
		title: edition.title ?? olid,
		authors: authors.filter((a): a is string => a !== null),
		publishers: edition.publishers ?? [],
		publishYear,
		subjects: work?.subjects?.slice(0, 5) ?? [],
		coverOlid: edition.covers?.length ? olid : undefined,
	}
}

/**
 * Build a cover URL from an edition OLID.
 */
export function bookCoverUrl(olid: string): string {
	return `https://covers.openlibrary.org/b/olid/${olid}-L.jpg`
}

/**
 * Builds a compact searchable meta string for an Open Library book.
 */
export function buildBookMeta(book: OpenLibraryBook): string {
	const parts: string[] = []
	if (book.authors.length) parts.push(book.authors.join(", "))
	if (book.publishers.length) parts.push(book.publishers.join(", "))
	if (book.subjects.length) parts.push(book.subjects.slice(0, 5).join(", "))
	return parts.join(" | ")
}
