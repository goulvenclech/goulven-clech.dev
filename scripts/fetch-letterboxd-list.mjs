#!/usr/bin/env node
/**
 * Scrape a public Letterboxd list into a JSON array of its films' TMDB ids.
 *
 * Letterboxd exposes the TMDB id on each film page as a body attribute
 * (data-tmdb-type / data-tmdb-id), so we walk the list's pages for film slugs,
 * then fetch one film page per slug. No auth, no official TMDB API. One request
 * per film, throttled and retried; reruns resume from the existing output so an
 * interrupted (or rate-limited) run can be continued without refetching.
 *
 * Usage:
 *   node scripts/fetch-letterboxd-list.mjs                       # default list → src/data/letterboxd-list.json
 *   node scripts/fetch-letterboxd-list.mjs <list-url>            # a different public list
 *   node scripts/fetch-letterboxd-list.mjs --out path.json       # custom output path (relative to cwd)
 *   node scripts/fetch-letterboxd-list.mjs --delay 1000          # ms between film requests (default 700)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")

const DEFAULT_LIST =
	"https://letterboxd.com/fcbarcelona/list/movies-everyone-should-watch-at-least-once/"
const DEFAULT_OUT = resolve(projectRoot, "src/data/letterboxd-list.json")
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
 * type is "movie" | "tv" | null; tmdbId/name/year are null when absent.
 */
export function parseFilm(html) {
	// Matched independently so attribute reordering can't drop the id.
	const idMatch = html.match(/data-tmdb-id="(\d+)"/)
	const typeMatch = html.match(/data-tmdb-type="([a-z]+)"/)
	const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/)
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

function parseArgs(argv) {
	const args = argv.slice(2)
	const flagValue = (name) => {
		const i = args.indexOf(name)
		return i >= 0 ? args[i + 1] : undefined
	}
	const listUrl = args.find((a) => !a.startsWith("--") && a.startsWith("http"))
	const out = flagValue("--out")
	const delay = Number(flagValue("--delay"))
	return {
		listUrl: listUrl ?? DEFAULT_LIST,
		outPath: out ? resolve(process.cwd(), out) : DEFAULT_OUT,
		delay: Number.isFinite(delay) && delay > 0 ? delay : 700,
	}
}

async function main() {
	const { listUrl, outPath, delay } = parseArgs(process.argv)

	// Resume from any prior run: keep already-fetched films, refetch only the rest.
	let existing = []
	try {
		existing = JSON.parse(readFileSync(outPath, "utf8"))
	} catch {
		existing = []
	}
	const bySlug = new Map(existing.map((e) => [e.slug, e]))

	console.log(`Fetching list slugs from ${listUrl}`)
	const slugs = await getListSlugs(listUrl, delay)
	console.log(`Found ${slugs.length} films; ${bySlug.size} already cached.`)

	const entries = []
	let fetched = 0
	let failed = 0
	for (const slug of slugs) {
		const cached = bySlug.get(slug)
		if (cached) {
			entries.push(cached)
			continue
		}
		try {
			const html = await fetchText(`https://letterboxd.com/film/${slug}/`)
			const film = parseFilm(html)
			// Usually a genuinely id-less film; a spike suggests a markup change.
			if (film.tmdbId == null && film.name != null) {
				console.warn(`  ${slug}: fetched OK but no TMDB id found`)
			}
			const entry = { slug, ...film }
			entries.push(entry)
			bySlug.set(slug, entry)
			fetched++
			// Persist incrementally so an interruption loses at most one film.
			writeOutput(outPath, orderBySlugs(slugs, bySlug))
			if (fetched % 25 === 0) console.log(`  fetched ${fetched} new films…`)
		} catch (err) {
			failed++
			console.error(`  failed ${slug}: ${err.message}`)
		}
		await sleep(delay)
	}

	const final = orderBySlugs(slugs, bySlug)
	writeOutput(outPath, final)

	const movies = final.filter((e) => e.type === "movie" && e.tmdbId != null)
	const tv = final.filter((e) => e.type === "tv")
	const noId = final.filter((e) => e.tmdbId == null)
	console.log(
		`Wrote ${final.length} films to ${outPath} ` +
			`(${movies.length} movies with a TMDB id, ${tv.length} tv, ${noId.length} without an id). ` +
			`${fetched} newly fetched, ${failed} failed.`,
	)
}

/** Reorder cached entries to match the list order, dropping any no longer listed. */
function orderBySlugs(slugs, bySlug) {
	return slugs.map((slug) => bySlug.get(slug)).filter(Boolean)
}

function writeOutput(outPath, entries) {
	mkdirSync(dirname(outPath), { recursive: true })
	writeFileSync(outPath, JSON.stringify(entries, null, "\t") + "\n", "utf8")
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
