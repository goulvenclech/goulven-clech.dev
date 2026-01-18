/**
 * Utils to fetch TMDB movie & TV data.
 * Docs → https://developer.themoviedb.org/reference/
 */
const TMDB_API = "https://api.themoviedb.org/3"

function headers() {
	// Prefer the (safer) v4 bearer token if you exposed it,
	// otherwise fall back to the classic v3 key in the query string.
	const token = import.meta.env.TMDB_TOKEN as string | undefined
	return token ? { Authorization: `Bearer ${token}` } : ({} as HeadersInit)
}

interface TmdbGenre {
	id: number
	name: string
}

interface TmdbTitleVariant {
	title: string
	type: string
}

interface TmdbCompany {
	id: number
	name: string
}

interface TmdbPerson {
	name: string
	job?: string // present only for crew entries
}

export interface TmdbMovie {
	id: number
	title: string
	release_date: string
	poster_path: string | null

	/* extra fields used by buildMovieMeta */
	genres?: TmdbGenre[]
	belongs_to_collection?: { name: string } | null
	alternative_titles?: { titles: TmdbTitleVariant[] }
	production_companies?: TmdbCompany[]
	credits?: {
		cast: TmdbPerson[]
		crew: TmdbPerson[]
	}
}

export interface TmdbShow {
	id: number
	name: string
	first_air_date: string
	poster_path: string | null

	/* extra fields used by buildShowMeta */
	genres?: TmdbGenre[]
	alternative_titles?: { results: TmdbTitleVariant[] }
	networks?: { name: string }[]
	aggregate_credits?: {
		cast: TmdbPerson[]
		crew: TmdbPerson[]
	}
}

export async function fetchMovie(id: number): Promise<TmdbMovie | null> {
	const res = await fetch(
		`${TMDB_API}/movie/${id}?language=en-US&append_to_response=alternative_titles,credits${
			import.meta.env.TMDB_KEY ? `&api_key=${import.meta.env.TMDB_KEY}` : ""
		}`,
		{ headers: headers() },
	)
	if (!res.ok) return null
	return (await res.json()) as TmdbMovie
}

export async function fetchShow(id: number): Promise<TmdbShow | null> {
	const res = await fetch(
		`${TMDB_API}/tv/${id}?language=en-US&append_to_response=alternative_titles,aggregate_credits${
			import.meta.env.TMDB_KEY ? `&api_key=${import.meta.env.TMDB_KEY}` : ""
		}`,
		{ headers: headers() },
	)
	if (!res.ok) return null
	return (await res.json()) as TmdbShow
}

export function posterUrl(path: string, size = "w500"): string {
	// TMDB's static image host uses /t/p/<size>/<file_path> :contentReference[oaicite:0]{index=0}
	return `https://image.tmdb.org/t/p/${size}${path}`
}

/**
 * Builds a concise, searchable meta string for a TMDB movie.
 * Expects the movie object to include `genres`, `belongs_to_collection`,
 * `production_companies`, and `alternative_titles.titles`.
 */
export function buildMovieMeta(movie: TmdbMovie): string {
	const parts: string[] = []

	if (movie.genres?.length)
		parts.push(movie.genres.map((g) => g.name).join(", "))

	if (movie.belongs_to_collection?.name)
		parts.push(movie.belongs_to_collection.name)

	if (movie.alternative_titles?.titles?.length) {
		const acronyms = movie.alternative_titles.titles
			.filter((t) => t.type === "Acronym")
			.map((t) => t.title)
		if (acronyms.length) parts.push(acronyms.join(", "))
	}

	if (movie.production_companies?.length)
		parts.push(movie.production_companies.map((c) => c.name).join(", "))

	const directors = movie.credits?.crew
		?.filter((c) => c.job === "Director")
		.map((c) => c.name)
	if (directors?.length) parts.push(directors.join(", "))

	const mainCast = movie.credits?.cast?.slice(0, 3).map((c) => c.name)
	if (mainCast?.length) parts.push(mainCast.join(", "))

	return parts.join(" | ")
}

/**
 * Same as above but for TV shows.
 * Uses `networks` instead of `production_companies`.
 */
export function buildShowMeta(show: TmdbShow): string {
	const parts: string[] = []

	if (show.genres?.length) parts.push(show.genres.map((g) => g.name).join(", "))

	if (show.alternative_titles?.results?.length) {
		const acronyms = show.alternative_titles.results
			.filter((t) => t.type === "Acronym")
			.map((t) => t.title)
		if (acronyms.length) parts.push(acronyms.join(", "))
	}

	if (show.networks?.length)
		parts.push(show.networks.map((n) => n.name).join(", "))

	const directors = show.aggregate_credits?.crew
		?.filter((c) => c.job === "Director")
		.map((c) => c.name)
	if (directors?.length) parts.push(directors.join(", "))

	const mainCast = show.aggregate_credits?.cast?.slice(0, 3).map((c) => c.name)
	if (mainCast?.length) parts.push(mainCast.join(", "))

	return parts.join(" | ")
}
