#!/usr/bin/env node
/**
 * Shared catalogue-style meta enrichment for the IGDB and Open Library to-do
 * list fetchers. Each entry is keyed on a catalogue source id, so we resolve the
 * same `meta` string the catalogue stores for a review (genre, developer,
 * author, subjects, …) and drop it onto the entry.
 *
 * The `buildXMeta` builders come from the catalogue source modules so the format
 * can't drift; fetching is reimplemented here because these scripts run under
 * plain Node (credentials from `.env`/`process.env`), not Astro's Vite pipeline
 * (`import.meta.env`). TMDB movie lists build their meta inline in
 * fetch-tmdb-list.mjs from the movie they already fetch, so no TMDB resolver
 * lives here.
 */
import { buildIgdbMeta } from "../src/pages/api/catalogue/sources/igdb.ts"
import {
	fetchBook,
	buildBookMeta,
} from "../src/pages/api/catalogue/sources/openlibrary.ts"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function igdbToken(env) {
	const res = await fetch(
		`https://id.twitch.tv/oauth2/token?client_id=${env.IGDB_ID}&client_secret=${env.IGDB_SECRET}&grant_type=client_credentials`,
		{ method: "POST" },
	)
	if (!res.ok) throw new Error(`Twitch token failed: HTTP ${res.status}`)
	return (await res.json()).access_token
}

/** An IGDB game with the expanded relations meta needs, or null. */
async function fetchGameById(env, token, id) {
	const res = await fetch("https://api.igdb.com/v4/games", {
		method: "POST",
		headers: { "Client-ID": env.IGDB_ID, Authorization: `Bearer ${token}` },
		body:
			`fields name,slug,first_release_date,cover.image_id,genres.name,` +
			`collection.name,alternative_names.name,alternative_names.comment,` +
			`involved_companies.developer,involved_companies.publisher,` +
			`involved_companies.company.name,platforms.name; where id = ${id}; limit 1;`,
	})
	if (!res.ok) return null
	const [game] = await res.json()
	return game ?? null
}

/**
 * Per-source recipe: which credentials it needs, how long to pause between calls
 * (each API's rate tolerance), an optional one-time setup (an IGDB token), and
 * how to turn one entry id into a catalogue-style meta string.
 */
const RESOLVERS = {
	IGDB: {
		needs: (env) => Boolean(env.IGDB_ID && env.IGDB_SECRET),
		missing: "IGDB_ID / IGDB_SECRET",
		delay: 260,
		init: (env) => igdbToken(env),
		async meta(env, token, id) {
			const game = await fetchGameById(env, token, id)
			return game ? buildIgdbMeta(game) : ""
		},
	},
	OPENLIBRARY: {
		needs: () => true,
		delay: 500,
		async meta(_env, _ctx, id) {
			const book = await fetchBook(String(id))
			return book ? buildBookMeta(book) : ""
		},
	},
}

/**
 * Fill `entry.meta` with catalogue-style metadata for every entry that lacks it,
 * resolving by the entry's source id. Mutates entries in place and returns a
 * `{ enriched, skipped }` summary.
 *
 * Resume-safe: entries that already carry a `meta` string are left untouched, so
 * reruns only fetch what's missing. Best-effort: an unsupported source, missing
 * credentials, or a failing fetch leaves entries without meta rather than
 * aborting — the list stays usable, search just falls back to titles.
 */
export async function enrichEntries(
	env,
	source,
	entries,
	{ log = () => {} } = {},
) {
	const resolver = RESOLVERS[source]
	if (!resolver) {
		log(`meta: ${source} not supported yet — leaving entries unenriched`)
		return { enriched: 0, skipped: entries.length }
	}
	if (!resolver.needs(env)) {
		log(`meta: missing ${resolver.missing} — skipping ${source} enrichment`)
		return { enriched: 0, skipped: entries.length }
	}

	const todo = entries.filter((entry) => typeof entry.meta !== "string")
	if (todo.length === 0) return { enriched: 0, skipped: entries.length }

	// A failed one-time setup (e.g. the IGDB token) skips enrichment rather than
	// aborting the caller's whole list build, matching the per-entry best effort.
	let ctx = null
	if (resolver.init) {
		try {
			ctx = await resolver.init(env)
		} catch (err) {
			log(`meta: ${source} setup failed (${err.message}) — leaving unenriched`)
			return { enriched: 0, skipped: entries.length }
		}
	}
	let enriched = 0
	let done = 0
	for (const entry of todo) {
		try {
			const meta = await resolver.meta(env, ctx, entry.id)
			// Leave empty meta unset rather than write "", so the next run retries it.
			if (meta) {
				entry.meta = meta
				enriched++
			}
		} catch (err) {
			log(`meta: failed for ${entry.id}: ${err.message}`)
		}
		done++
		if (done % 50 === 0 || done === todo.length)
			log(`  meta ${done}/${todo.length}…`)
		if (resolver.delay) await sleep(resolver.delay)
	}
	return { enriched, skipped: entries.length - todo.length }
}
