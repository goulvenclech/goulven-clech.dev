#!/usr/bin/env node
/**
 * Build a catalogue to-do list of books from a list config, resolving each
 * title to an Open Library edition OLID. A review may key on a different
 * edition, so "done" matching is best-effort. Reruns resume from the output.
 *
 * Books are [title, author, year] tuples resolved by search, or
 * [title, author, year, id] where id is an ISBN or edition OLID resolved
 * directly (the search is noisy for translations, anthologies and new books).
 *
 * Usage:
 *   node scripts/fetch-openlibrary-list.mjs --list modern-philosophy-pile
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { readListConfig } from "./listConfig.mjs"
import { enrichEntries } from "./catalogueMeta.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")
const outDir = resolve(projectRoot, "src/data/lists")
const configDir = resolve(__dirname, "list-configs/openlibrary")

// Open Library asks for a descriptive User-Agent with contact info.
const OL_HEADERS = {
	"User-Agent": "goulven-clech.dev list builder (nevilain@gmail.com)",
}

const OLID_RE = /^OL\d+M$/i

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function bookCoverUrl(coverId, size = "L") {
	return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
}

// ?default=false makes the API 404 (not a blank image) when the edition has no
// cover, so the grid falls back to its title placeholder.
export function olidCoverUrl(olid, size = "L") {
	return `https://covers.openlibrary.org/b/olid/${olid}-${size}.jpg?default=false`
}

/** Lowercase and strip punctuation/accents so titles and authors compare on their words. */
export function normalizeText(s) {
	return s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
}

/**
 * Best search doc for an expected title and author, or null when nothing fits.
 * Requires the author's surname to appear, then prefers an exact title and a doc
 * that carries a cover edition.
 */
export function pickBook(docs, title, author) {
	const wantTitle = normalizeText(title)
	const surname = normalizeText(author).split(" ").pop() ?? ""
	const scored = docs
		.filter((doc) => {
			const authors = (doc.author_name ?? []).map(normalizeText).join(" ")
			// No edition OLID means nothing for the catalogue to key on.
			const hasOlid = doc.cover_edition_key ?? doc.edition_key?.[0]
			return hasOlid && surname && authors.includes(surname)
		})
		.map((doc) => {
			const docTitle = normalizeText(doc.title ?? "")
			let score = 0
			if (docTitle === wantTitle) score += 100
			else if (docTitle.includes(wantTitle) || wantTitle.includes(docTitle))
				score += 40
			if (doc.cover_edition_key) score += 10
			if (doc.cover_i) score += 5
			return { doc, score }
		})
		// A surname match with no title overlap is a different book — drop it.
		.filter(({ score }) => score >= 40)
		.sort((a, b) => b.score - a.score)
	return scored[0]?.doc ?? null
}

/** A search doc → a catalogue-keyed to-do entry, or null when it has no edition OLID. */
export function bookToEntry(doc, name, year) {
	const olid = doc.cover_edition_key ?? doc.edition_key?.[0]
	if (!olid) return null
	return {
		id: olid,
		name,
		year,
		poster: doc.cover_i ? bookCoverUrl(doc.cover_i) : null,
		link: `https://openlibrary.org/books/${olid}`,
	}
}

/** A bare edition OLID → an entry, without a network round-trip. */
export function olidToEntry(olid, name, year) {
	return {
		id: olid,
		name,
		year,
		poster: olidCoverUrl(olid),
		link: `https://openlibrary.org/books/${olid}`,
	}
}

/** An Open Library edition record (from /isbn/ or /books/) → an entry, or null. */
export function editionToEntry(record, name, year) {
	const olid = record?.key?.match(/OL\d+M/)?.[0]
	if (!olid) return null
	// Open Library uses -1 as a "no cover" sentinel in the covers array.
	const cover = record.covers?.find((c) => c > 0)
	return {
		id: olid,
		name,
		year,
		poster: cover ? bookCoverUrl(cover) : null,
		link: `https://openlibrary.org/books/${olid}`,
	}
}

/** Fetch JSON, retrying with backoff on network errors and non-2xx (e.g. 429). */
async function fetchJson(url, { retries = 4 } = {}) {
	for (let attempt = 0; ; attempt++) {
		try {
			const res = await fetch(url, { headers: OL_HEADERS })
			if (res.ok) return res.json()
			if (attempt >= retries) throw new Error(`HTTP ${res.status} for ${url}`)
		} catch (err) {
			if (attempt >= retries) throw err
		}
		await sleep(1000 * (attempt + 1))
	}
}

async function search(title, author) {
	// The general `q` search is far more forgiving than title+author fields
	// (which miss edited volumes or short-titled works); Solr treats ?/*/" as
	// operators, so reduce to plain words and let pickBook re-check title+author.
	const q = `${title} ${author}`.replace(/[^\p{L}\p{N}]+/gu, " ").trim()
	const params = new URLSearchParams({
		q,
		fields: "title,author_name,cover_i,cover_edition_key,edition_key",
		limit: "5",
	})
	const data = await fetchJson(`https://openlibrary.org/search.json?${params}`)
	return data.docs ?? []
}

/** Resolve one config book to an entry: by explicit ISBN/OLID, else by search. */
async function resolveBook(title, author, year, identifier) {
	if (identifier) {
		if (OLID_RE.test(identifier)) {
			return olidToEntry(identifier.toUpperCase(), title, year)
		}
		try {
			const record = await fetchJson(
				`https://openlibrary.org/isbn/${identifier}.json`,
			)
			return editionToEntry(record, title, year)
		} catch {
			return null
		}
	}
	const doc = pickBook(await search(title, author), title, author)
	return doc && bookToEntry(doc, title, year)
}

/** Prior entries by name from the current output, so reruns keep resolved books. */
function loadExisting(outPath) {
	try {
		const { entries = [] } = JSON.parse(readFileSync(outPath, "utf8"))
		return new Map(entries.map((entry) => [entry.name, entry]))
	} catch {
		return new Map()
	}
}

async function main() {
	const args = process.argv.slice(2)
	const { listName, config } = readListConfig(args, configDir)
	const { books, ...list } = config
	if (!list.id || !Array.isArray(books) || books.length === 0) {
		console.error(
			`Config "${listName}.json" needs an id and a non-empty books array`,
		)
		process.exit(1)
	}
	if (
		!books.every(
			(b) =>
				Array.isArray(b) &&
				(b.length === 3 || b.length === 4) &&
				typeof b[0] === "string" &&
				typeof b[1] === "string" &&
				typeof b[2] === "number" &&
				(b.length === 3 || typeof b[3] === "string"),
		)
	) {
		console.error(
			`Config "${listName}.json" books must be [title, author, year] or [title, author, year, isbn|olid] tuples`,
		)
		process.exit(1)
	}

	const outPath = resolve(outDir, `${list.id}.json`)
	const existing = loadExisting(outPath)

	const entries = []
	const misses = []
	for (const [title, author, year, identifier] of books) {
		const cached = existing.get(title)
		if (cached) {
			entries.push(cached)
			continue
		}
		const entry = await resolveBook(title, author, year, identifier)
		if (!entry) {
			misses.push(`${title} (${year})`)
			console.error(`  no match: ${title} (${year})`)
		} else {
			entries.push(entry)
		}
		await sleep(500)
	}

	// Open Library needs no credentials, so there's no env to thread through.
	await enrichEntries({}, list.source, entries, { log: console.error })

	mkdirSync(outDir, { recursive: true })
	writeFileSync(
		outPath,
		JSON.stringify({ ...list, entries }, null, "\t") + "\n",
	)
	console.log(
		`Wrote ${entries.length}/${books.length} books to ${outPath}` +
			(misses.length ? ` (unresolved: ${misses.join(", ")})` : ""),
	)
}

if (
	process.argv[1] &&
	fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
	main().catch((err) => {
		console.error("Fetch failed:", err)
		process.exit(1)
	})
}
