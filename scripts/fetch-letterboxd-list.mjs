#!/usr/bin/env node
/**
 * Scrape a Letterboxd list into a TMDB list-config that fetch-tmdb-list.mjs
 * builds into the actual to-do list. Letterboxd exposes each film's TMDB id on
 * its film page (data-tmdb-id), so we crawl the list's pages for slugs, fetch one
 * film page per slug, and collect [tmdb id, name] tuples. No auth, no TMDB API
 * here — year, poster, and meta all come from TMDB later, via fetch-tmdb-list.mjs.
 *
 * Run this only to refresh a list's *membership*; to refresh the data (posters,
 * meta) re-run fetch-tmdb-list.mjs against the generated config — no crawl needed.
 *
 * Input:  scripts/list-configs/letterboxd/<name>.json — list metadata + the `url`
 *         of the public list to crawl.
 * Output: scripts/list-configs/tmdb/<name>.json — the same metadata + a `movies`
 *         array of [tmdb id, name] tuples. Run `pnpm format` on it before
 *         committing, so its tuples match prettier's inline style.
 *
 * Usage:
 *   node scripts/fetch-letterboxd-list.mjs --list movies-everyone-should-watch
 *   node scripts/fetch-letterboxd-list.mjs --list movies-everyone-should-watch --delay 1000
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { readListConfig } from "./listConfig.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const configDir = resolve(__dirname, "list-configs/letterboxd")
const outConfigDir = resolve(__dirname, "list-configs/tmdb")

// Letterboxd serves a default UA less reliably.
const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Film slugs on a list page, in list order (deduped by caller across pages). */
export function parseSlugs(html) {
	const slugs = []
	const re = /data-target-link="\/film\/([^"/]+)\/"/g
	let m
	while ((m = re.exec(html)) !== null) slugs.push(m[1])
	return slugs
}

/**
 * The TMDB id, type, and display name from a film page. type is
 * "movie" | "tv" | null; tmdbId is null when the film carries no TMDB link.
 */
export function parseFilm(html) {
	// Matched independently so attribute reordering can't drop the id.
	const idMatch = html.match(/data-tmdb-id="(\d+)"/)
	const typeMatch = html.match(/data-tmdb-type="([a-z]+)"/)
	const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/)
	let name = null
	if (titleMatch) {
		const raw = decodeEntities(titleMatch[1])
		// Strip Letterboxd's "(YYYY)" suffix; the year comes from TMDB downstream.
		const withYear = raw.match(/^(.*) \((\d{4})\)$/)
		name = withYear ? withYear[1] : raw
	}
	return {
		type: typeMatch ? typeMatch[1] : null,
		tmdbId: idMatch ? Number(idMatch[1]) : null,
		name,
	}
}

/** Minimal HTML-entity decode for the few that appear in film titles. */
function decodeEntities(s) {
	return s
		.replace(/&amp;/g, "&")
		.replace(/&#0?39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
}

/** A parsed film → a [tmdb id, name] config tuple, or null if it's not a named TMDB movie. */
export function toMovie(film) {
	// A missing name would write a malformed tuple that aborts the whole
	// fetch-tmdb-list build, so treat a nameless film as untrackable.
	if (
		film.tmdbId == null ||
		!film.name ||
		(film.type != null && film.type !== "movie")
	)
		return null
	return [film.tmdbId, film.name]
}

/** Fetch a URL as text, retrying with backoff on network errors and non-2xx (e.g. 403/429). */
async function fetchText(url, { retries = 4 } = {}) {
	for (let attempt = 0; ; attempt++) {
		try {
			const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } })
			if (res.ok) return await res.text()
			if (attempt >= retries) {
				throw new Error(`HTTP ${res.status} for ${url}`)
			}
		} catch (err) {
			if (attempt >= retries) throw err
		}
		// Backoff with jitter; the host rate-limits bursts.
		await sleep(1500 * (attempt + 1) + Math.floor(Math.random() * 500))
	}
}

/** All film slugs of a list, walking pages until one comes back empty. */
async function getListSlugs(listUrl, delay) {
	const base = listUrl.replace(/\/$/, "")
	const slugs = []
	const seen = new Set()
	for (let page = 1; ; page++) {
		const html = await fetchText(`${base}/page/${page}/`)
		const pageSlugs = parseSlugs(html)
		if (pageSlugs.length === 0) break
		for (const slug of pageSlugs) {
			if (!seen.has(slug)) {
				seen.add(slug)
				slugs.push(slug)
			}
		}
		console.log(`  list page ${page}: ${pageSlugs.length} films`)
		await sleep(delay)
	}
	return slugs
}

async function main() {
	const args = process.argv.slice(2)
	const delayArg = Number(args[args.indexOf("--delay") + 1])
	const delay = Number.isFinite(delayArg) && delayArg > 0 ? delayArg : 700

	const { listName, config } = readListConfig(args, configDir)
	if (!config.id || !config.url) {
		console.error(`Config "${listName}.json" needs an id and a url to crawl`)
		process.exit(1)
	}

	const slugs = await getListSlugs(config.url, delay)
	console.log(`${slugs.length} films to resolve…`)

	const movies = []
	let skipped = 0
	let failed = 0
	for (const slug of slugs) {
		try {
			const movie = toMovie(
				parseFilm(await fetchText(`https://letterboxd.com/film/${slug}/`)),
			)
			// A TV entry or a film with no TMDB movie link isn't trackable here.
			if (movie) movies.push(movie)
			else skipped++
		} catch (err) {
			failed++
			console.error(`  failed ${slug}: ${err.message}`)
		}
		await sleep(delay)
	}

	const outPath = resolve(outConfigDir, `${listName}.json`)
	mkdirSync(outConfigDir, { recursive: true })
	writeFileSync(
		outPath,
		JSON.stringify({ ...config, movies }, null, "\t") + "\n",
	)
	console.log(
		`Wrote ${movies.length} movies to ${outPath}. ` +
			`${skipped} skipped (tv/no id), ${failed} failed. ` +
			`Run fetch-tmdb-list.mjs --list ${listName} to build the data.`,
	)
}

// Only run when invoked directly, so the parse helpers stay importable in tests.
if (
	process.argv[1] &&
	fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
	main().catch((err) => {
		console.error("Fetch failed:", err)
		process.exit(1)
	})
}
