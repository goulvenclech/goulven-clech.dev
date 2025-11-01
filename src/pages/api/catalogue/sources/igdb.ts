/**
 * Utils to fetch IGDB game data.
 * See documentation -> https://api-docs.igdb.com/#getting-started
 */
const TOKEN_URL = "https://id.twitch.tv/oauth2/token?grant_type=client_credentials"

const IGDB_API = "https://api.igdb.com/v4"
let accessToken: string | null = null
let tokenExpires = 0

/**
 * Get an access token from Twitch API.
 */
async function getToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpires) return accessToken

  const res = await fetch(
    `${TOKEN_URL}&client_id=${import.meta.env.IGDB_ID}` +
      `&client_secret=${import.meta.env.IGDB_SECRET}`,
    { method: "POST" }
  )

  if (!res.ok) {
    throw new Error(`IGDB token error ${res.status}: ${await res.text()}`)
  }

  const { access_token, expires_in } = (await res.json()) as {
    access_token: string
    expires_in: number
  }

  accessToken = access_token
  // refresh token 1 minute before it expires
  tokenExpires = Date.now() + expires_in * 1000 - 60_000
  return accessToken!
}

export interface IgdbCompanyRef {
  name: string
}

export interface IgdbInvolvedCompany {
  developer?: boolean
  publisher?: boolean
  company?: IgdbCompanyRef
}

export interface IgdbGenre {
  name: string
}

export interface IgdbPlatform {
  name: string
}

export interface IgdbAlternativeName {
  name: string
  comment?: string
}

export interface IgdbCollection {
  name: string
}

export interface IgdbGame {
  id: number
  name: string
  slug: string
  first_release_date?: number // UNIX timestamp (s) - optional for unreleased games
  cover?: { image_id: string }

  /* extra fields used by buildIgdbMeta */
  genres?: IgdbGenre[]
  collection?: IgdbCollection
  alternative_names?: IgdbAlternativeName[]
  involved_companies?: IgdbInvolvedCompany[]
  platforms?: IgdbPlatform[]
}

/**
 * Fetch a game by its ID.
 */
export async function fetchGame(id: number): Promise<IgdbGame | null> {
  const token = await getToken()

  const body = `
    fields
      name,
      slug,
      first_release_date,
      cover.image_id,
      genres.name,
      collection.name,
      alternative_names.name,
      alternative_names.comment,
      involved_companies.developer,
      involved_companies.publisher,
      involved_companies.company.name,
      platforms.name;
    where id = ${id};
    limit 1;
  `.trim()

  const res = await fetch(`${IGDB_API}/games`, {
    method: "POST",
    headers: {
      "Client-ID": import.meta.env.IGDB_ID as string,
      Authorization: `Bearer ${token}`,
    },
    body,
  })

  if (!res.ok) {
    console.error("IGDB game fetch error:", await res.text())
    return null
  }

  const [game] = (await res.json()) as IgdbGame[]
  return game ?? null
}

/**
 * Build a cover URL from an image ID.
 */
export function coverUrl(imageId: string, size = "cover_big_2x"): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`
}

/**
 * Builds a compact searchable meta string for an IGDB game.
 * Expected game object already contains expanded relations.
 */
export function buildIgdbMeta(game: IgdbGame): string {
  const parts: string[] = []

  if (game.genres?.length) parts.push(game.genres.map((g) => g.name).join(", "))

  if (game.collection?.name) parts.push(game.collection.name)

  if (game.alternative_names?.length) {
    const acronyms = game.alternative_names
      .filter((n) => n.comment?.toLowerCase() === "acronym")
      .map((n) => n.name)
      .filter(Boolean)
    if (acronyms.length) parts.push(acronyms.join(", "))
  }

  if (game.involved_companies?.length) {
    const devs = game.involved_companies
      .filter((c) => c.developer)
      .map((c) => c.company?.name)
      .filter(Boolean)
    if (devs.length) parts.push(devs.join(", "))

    const pubs = game.involved_companies
      .filter((c) => c.publisher)
      .map((c) => c.company?.name)
      .filter(Boolean)
    if (pubs.length) parts.push(pubs.join(", "))
  }

  if (game.platforms?.length) parts.push(game.platforms.map((p) => p.name).join(", "))

  return parts.join(" | ")
}
