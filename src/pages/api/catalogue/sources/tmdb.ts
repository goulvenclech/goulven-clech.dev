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

export interface TmdbMovie {
  id: number
  title: string
  release_date: string
  poster_path: string | null
}

export interface TmdbShow {
  id: number
  name: string
  first_air_date: string
  poster_path: string | null
}

export async function fetchMovie(id: number): Promise<TmdbMovie | null> {
  const res = await fetch(
    `${TMDB_API}/movie/${id}?language=en-US${
      import.meta.env.TMDB_KEY ? `&api_key=${import.meta.env.TMDB_KEY}` : ""
    }`,
    { headers: headers() }
  )
  if (!res.ok) return null
  return (await res.json()) as TmdbMovie
}

export async function fetchShow(id: number): Promise<TmdbShow | null> {
  const res = await fetch(
    `${TMDB_API}/tv/${id}?language=en-US${
      import.meta.env.TMDB_KEY ? `&api_key=${import.meta.env.TMDB_KEY}` : ""
    }`,
    { headers: headers() }
  )
  if (!res.ok) return null
  return (await res.json()) as TmdbShow
}

export function posterUrl(path: string, size = "w500"): string {
  // TMDB’s static image host uses /t/p/<size>/<file_path> :contentReference[oaicite:0]{index=0}
  return `https://image.tmdb.org/t/p/${size}${path}`
}
