/**
 * Spotify album helpers (client-credentials flow)
 * Docs: https://developer.spotify.com/documentation/web-api
 */
const TOKEN_URL = "https://accounts.spotify.com/api/token"
const API = "https://api.spotify.com/v1"

const ID = import.meta.env.SPOTIFY_ID as string | undefined
const SECRET = import.meta.env.SPOTIFY_SECRET as string | undefined
if (!ID || !SECRET) throw new Error("Missing SPOTIFY_ID / SPOTIFY_SECRET")

let tokenCache: { value: string; expires: number } | null = null

async function getToken(): Promise<string> {
	if (tokenCache && Date.now() < tokenCache.expires) return tokenCache.value

	const res = await fetch(TOKEN_URL, {
		method: "POST",
		headers: {
			Authorization: `Basic ${btoa(`${ID}:${SECRET}`)}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials",
	})
	if (!res.ok) throw new Error("Spotify auth failed")

	const { access_token, expires_in } = (await res.json()) as {
		access_token: string
		expires_in: number
	}
	tokenCache = {
		value: access_token,
		expires: Date.now() + (expires_in - 30) * 1000,
	}
	return access_token
}

interface SpotifyImage {
	url: string
	width: number
	height: number
}

interface SpotifyArtist {
	name: string
}

export interface SpotifyAlbum {
	id: string
	name: string
	release_date: string // yyyy-mm-dd
	images: SpotifyImage[]
	genres: string[]
	label: string
	artists: SpotifyArtist[]
	external_urls: { spotify: string }
}

export async function fetchAlbum(id: string): Promise<SpotifyAlbum | null> {
	const res = await fetch(`${API}/albums/${id}?market=US`, {
		headers: { Authorization: `Bearer ${await getToken()}` },
	})
	if (!res.ok) return null
	return (await res.json()) as SpotifyAlbum
}

export function albumCoverUrl(
	album: SpotifyAlbum,
	size: "small" | "medium" | "large" = "medium",
) {
	const sorted = [...album.images].sort((a, b) => a.width - b.width) // small->large
	return (
		(size === "small" && sorted[0]) ||
		(size === "large" && sorted.at(-1)) ||
		sorted[Math.floor(sorted.length / 2)]
	)?.url
}

export function buildAlbumMeta(album: SpotifyAlbum): string {
	const parts: string[] = []

	if (album.artists?.length)
		parts.push(album.artists.map((a) => a.name).join(", "))
	if (album.genres?.length) parts.push(album.genres.join(", "))
	if (album.label) parts.push(album.label)

	return parts.join(" | ")
}
