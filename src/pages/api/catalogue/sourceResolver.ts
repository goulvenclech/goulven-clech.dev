import { fetchGame, coverUrl, buildIgdbMeta } from "./sources/igdb"
import {
	buildMovieMeta,
	buildShowMeta,
	fetchMovie,
	fetchShow,
	posterUrl,
} from "./sources/tmdb"
import { fetchBoardGame, buildBggMeta } from "./sources/bgg"
import { fetchAlbum, albumCoverUrl, buildAlbumMeta } from "./sources/spotify"
import { fetchBook, bookCoverUrl, buildBookMeta } from "./sources/openlibrary"

export interface ResolvedSource {
	source_name: string
	source_link: string
	source_img: string
	meta: string
}

/** Returns null when the upstream item does not exist (caller maps to 404). */
type SourceResolver = (sourceId: string) => Promise<ResolvedSource | null>

/** The keys are the source allowlist; a source without an entry is rejected. */
export const sourceResolvers: Record<string, SourceResolver> = {
	IGDB: async (sourceId) => {
		const game = await fetchGame(Number(sourceId))
		if (!game) return null

		const year = game.first_release_date
			? new Date(game.first_release_date * 1000).getFullYear()
			: "TBD"
		return {
			source_name: `${game.name} (${year})`,
			source_link: `https://www.igdb.com/games/${game.slug}`,
			source_img: game.cover?.image_id ? coverUrl(game.cover.image_id) : "",
			meta: buildIgdbMeta(game),
		}
	},

	BGG: async (sourceId) => {
		const game = await fetchBoardGame(Number(sourceId))
		if (!game) return null

		const year = game.year ?? "??"
		return {
			source_name: `${game.name} (${year})`,
			source_link: `https://boardgamegeek.com/boardgame/${game.id}`,
			source_img: game.image ?? "",
			meta: buildBggMeta(game),
		}
	},

	TMDB_MOVIE: async (sourceId) => {
		const movie = await fetchMovie(Number(sourceId))
		if (!movie) return null

		const year = movie.release_date
			? new Date(movie.release_date).getFullYear()
			: "??"
		return {
			source_name: `${movie.title} (${year})`,
			source_link: `https://www.themoviedb.org/movie/${movie.id}`,
			source_img: movie.poster_path ? posterUrl(movie.poster_path) : "",
			meta: buildMovieMeta(movie),
		}
	},

	TMDB_TV: async (sourceId) => {
		const show = await fetchShow(Number(sourceId))
		if (!show) return null

		const year = show.first_air_date
			? new Date(show.first_air_date).getFullYear()
			: "??"
		return {
			source_name: `${show.name} (${year})`,
			source_link: `https://www.themoviedb.org/tv/${show.id}`,
			source_img: show.poster_path ? posterUrl(show.poster_path) : "",
			meta: buildShowMeta(show),
		}
	},

	SPOTIFY: async (sourceId) => {
		const album = await fetchAlbum(String(sourceId))
		if (!album) return null

		const year = album.release_date?.slice(0, 4) || "??"
		return {
			source_name: `${album.name} (${year})`,
			source_link: album.external_urls.spotify,
			source_img: album.images?.length ? (albumCoverUrl(album) ?? "") : "",
			meta: buildAlbumMeta(album),
		}
	},

	OPENLIBRARY: async (sourceId) => {
		const book = await fetchBook(String(sourceId))
		if (!book) return null

		const year = book.publishYear ?? "??"
		return {
			source_name: `${book.title} (${year})`,
			source_link: `https://openlibrary.org/books/${sourceId}`,
			source_img: book.coverOlid ? bookCoverUrl(book.coverOlid) : "",
			meta: buildBookMeta(book),
		}
	},
}
