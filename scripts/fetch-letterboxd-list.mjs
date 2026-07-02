#!/usr/bin/env node
/**
 * Scrape a Letterboxd list into a catalogue to-do list of TMDB movies.
 *
 * Letterboxd exposes the TMDB id on each film page as a body attribute
 * (data-tmdb-id), so we gather film slugs — by crawling a list's pages, or from
 * an explicit `slugs` array — then fetch one film page per slug. No auth, no
 * official TMDB API. Throttled and retried; reruns resume from the existing
 * output so an interrupted (or rate-limited) run can be continued.
 *
 * Each list is a config at scripts/letterboxd-lists/<name>.json holding the list
 * metadata plus either a `url` (a public list to crawl) or a `slugs` array.
 *
 * Usage:
 *   node scripts/fetch-letterboxd-list.mjs --list movies-everyone-should-watch
 *   node scripts/fetch-letterboxd-list.mjs --list 007-films --delay 1000
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")
const outDir = resolve(projectRoot, "src/data/lists")
const configDir = resolve(__dirname, "letterboxd-lists")

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
 * TMDB id and display metadata from a film page.
 * type is "movie" | "tv" | null; tmdbId/name/year/poster are null when absent.
 */
export function parseFilm(html) {
	// Matched independently so attribute reordering can't drop the id.
	const idMatch = html.match(/data-tmdb-id="(\d+)"/)
	const typeMatch = html.match(/data-tmdb-type="([a-z]+)"/)
	const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/)
	// The JSON-LD image is the 2:3 portrait poster (…-0-600-0-900-crop.jpg);
	// og:image is a landscape crop. The path varies (film-poster/… or sm/upload/…).
	const posterMatch = html.match(
		/"image":"(https:\/\/a\.ltrbxd\.com\/resized\/[^"]+-0-600-0-900-crop\.jpg[^"]*)"/,
	)
	let name = null
	let year = null
	if (titleMatch) {
		const raw = decodeEntities(titleMatch[1])
		const withYear = raw.match(/^(.*) \((\d{4})\)$/)
		if (withYear) {
			name = withYear[1]
			year = Number(withYear[2])
		} else {
			name = raw
		}
	}
	return {
		type: typeMatch ? typeMatch[1] : null,
		tmdbId: idMatch ? Number(idMatch[1]) : null,
		name,
		year,
		poster: posterMatch ? posterMatch[1] : null,
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

/** A parsed film (or a cached entry) → a catalogue-keyed to-do entry, or null if not a TMDB movie. */
export function toEntry(slug, film) {
	const id = film.tmdbId ?? film.id
	if (id == null || (film.type != null && film.type !== "movie")) return null
	return {
		id,
		name: film.name,
		year: film.year,
		poster: film.poster ?? null,
		link: `https://www.themoviedb.org/movie/${id}`,
		slug,
	}
}

/** Prior entries by slug from the current output, so reruns skip fetched films. */
function loadBySlug(outPath) {
	try {
		const { entries = [] } = JSON.parse(readFileSync(outPath, "utf8"))
		const bySlug = new Map()
		for (const row of entries) {
			const entry = toEntry(row.slug, row)
			if (entry) bySlug.set(row.slug, entry)
		}
		return bySlug
	} catch {
		return new Map()
	}
}

/** Names of the available list configs, for the usage hint. */
function availableConfigs() {
	try {
		return readdirSync(configDir)
			.filter((f) => f.endsWith(".json"))
			.map((f) => f.replace(/\.json$/, ""))
	} catch {
		return []
	}
}

async function main() {
	const args = process.argv.slice(2)
	const listArg = args.indexOf("--list")
	const listName = listArg >= 0 ? args[listArg + 1] : undefined
	const delayArg = Number(args[args.indexOf("--delay") + 1])
	const delay = Number.isFinite(delayArg) && delayArg > 0 ? delayArg : 700

	// Keep --list to a bare config name; it becomes a filesystem path below.
	if (!listName || /[/\\]|\.\./.test(listName)) {
		console.error(
			`Usage: node scripts/fetch-letterboxd-list.mjs --list <name>\n` +
				`Available: ${availableConfigs().join(", ") || "(none)"}`,
		)
		process.exit(1)
	}

	let config
	try {
		config = JSON.parse(
			readFileSync(resolve(configDir, `${listName}.json`), "utf8"),
		)
	} catch {
		console.error(
			`No config "${listName}". Available: ${availableConfigs().join(", ") || "(none)"}`,
		)
		process.exit(1)
	}
	const { slugs: explicitSlugs, ...list } = config
	if (!list.id || (!list.url && !Array.isArray(explicitSlugs))) {
		console.error(
			`Config "${listName}.json" needs an id and a url or slugs array`,
		)
		process.exit(1)
	}
	if (explicitSlugs && !explicitSlugs.every((s) => typeof s === "string")) {
		console.error(`Config "${listName}.json" slugs must all be strings`)
		process.exit(1)
	}

	const outPath = resolve(outDir, `${list.id}.json`)
	const bySlug = loadBySlug(outPath)

	const slugs = explicitSlugs ?? (await getListSlugs(list.url, delay))
	console.log(`${slugs.length} films; ${bySlug.size} already cached.`)

	let fetched = 0
	let failed = 0
	let skipped = 0
	for (const slug of slugs) {
		if (bySlug.has(slug)) continue
		try {
			const html = await fetchText(`https://letterboxd.com/film/${slug}/`)
			const entry = toEntry(slug, parseFilm(html))
			if (!entry) {
				// A TV entry or a film with no TMDB movie link — not trackable here.
				skipped++
			} else {
				bySlug.set(slug, entry)
				fetched++
				writeOutput(outPath, list, orderBySlugs(slugs, bySlug))
				if (fetched % 25 === 0) console.log(`  fetched ${fetched} new films…`)
			}
		} catch (err) {
			failed++
			console.error(`  failed ${slug}: ${err.message}`)
		}
		await sleep(delay)
	}

	const entries = orderBySlugs(slugs, bySlug)
	writeOutput(outPath, list, entries)
	console.log(
		`Wrote ${entries.length} movies to ${outPath}. ` +
			`${fetched} newly fetched, ${skipped} skipped (tv/no id), ${failed} failed.`,
	)
}

/** Entries in list order, dropping slugs that resolved to nothing. */
function orderBySlugs(slugs, bySlug) {
	return slugs.map((slug) => bySlug.get(slug)).filter(Boolean)
}

function writeOutput(outPath, list, entries) {
	mkdirSync(dirname(outPath), { recursive: true })
	writeFileSync(
		outPath,
		JSON.stringify({ ...list, entries }, null, "\t") + "\n",
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
