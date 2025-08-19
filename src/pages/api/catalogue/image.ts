import type { APIContext } from "astro"
import { fetchGame, coverUrl } from "./sources/igdb"
import { fetchBoardGame } from "./sources/bgg"
import { fetchMovie, fetchShow, posterUrl } from "./sources/tmdb"
import { fetchAlbum, albumCoverUrl } from "./sources/spotify"
import { computeImageFocusY } from "../../../imageFocus"

export const prerender = false

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export async function POST({ request }: APIContext): Promise<Response> {
  try {
    const body = await request.json()
    const source: string | undefined = body?.source
    const source_id: string | undefined = body?.source_id
    if (!source || !source_id) return json({ error: "Bad Request" }, 400)

    let source_img = ""
    switch (source) {
      case "IGDB": {
        const game = await fetchGame(Number(source_id))
        if (game?.cover?.image_id) source_img = coverUrl(game.cover.image_id)
        break
      }
      case "BGG": {
        const game = await fetchBoardGame(Number(source_id))
        if (game?.image) source_img = game.image
        break
      }
      case "TMDB_MOVIE": {
        const movie = await fetchMovie(Number(source_id))
        if (movie?.poster_path) source_img = posterUrl(movie.poster_path)
        break
      }
      case "TMDB_TV": {
        const show = await fetchShow(Number(source_id))
        if (show?.poster_path) source_img = posterUrl(show.poster_path)
        break
      }
      case "SPOTIFY": {
        const album = await fetchAlbum(String(source_id))
        if (album?.images?.length) source_img = albumCoverUrl(album)
        break
      }
      default:
        return json({ error: "Unknown source" }, 400)
    }

    if (!source_img) return json({ error: "Image not found" }, 404)

    const source_img_focus_y = await computeImageFocusY(source_img)
    return json({ source_img, source_img_focus_y })
  } catch (err) {
    console.error("POST /image failed:", err)
    return json({ error: "Server error" }, 500)
  }
}
