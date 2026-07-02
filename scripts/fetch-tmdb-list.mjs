#!/usr/bin/env node
/**
 * Build a catalogue to-do list of films from their TMDB ids.
 *
 * For film lists that aren't a Letterboxd list, we go straight to the TMDB API
 * (the catalogue already keys movie reviews on the TMDB id) to pull each film's
 * year and poster. Each list is a config at scripts/list-configs/tmdb/<name>.json
 * holding the list metadata plus a `movies` array of [tmdb id, display name].
 *
 * Needs TMDB_TOKEN (v4 bearer) or TMDB_KEY (v3) in .env.
 *
 * Usage:
 *   node scripts/fetch-tmdb-list.mjs --list 007-films
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { loadEnv, readListConfig } from "./listConfig.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")
const outDir = resolve(projectRoot, "src/data/lists")
const configDir = resolve(__dirname, "list-configs/tmdb")

const TMDB_API = "https://api.themoviedb.org/3"

export function posterUrl(path, size = "w500") {
	return `https://image.tmdb.org/t/p/${size}${path}`
}

export function movieToEntry(id, name, movie) {
	if (!movie) return null
	return {
		id,
		name,
		year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
		poster: movie.poster_path ? posterUrl(movie.poster_path) : null,
		link: `https://www.themoviedb.org/movie/${id}`,
	}
}

async function fetchMovie(env, id) {
	const key = env.TMDB_KEY ? `&api_key=${env.TMDB_KEY}` : ""
	const headers = env.TMDB_TOKEN
		? { Authorization: `Bearer ${env.TMDB_TOKEN}` }
		: {}
	const res = await fetch(`${TMDB_API}/movie/${id}?language=en-US${key}`, {
		headers,
	})
	if (!res.ok) return null
	return res.json()
}

async function main() {
	const args = process.argv.slice(2)
	const { listName, config } = readListConfig(args, configDir)
	const { movies, ...list } = config
	if (!list.id || !Array.isArray(movies) || movies.length === 0) {
		console.error(
			`Config "${listName}.json" needs an id and a non-empty movies array`,
		)
		process.exit(1)
	}
	if (
		!movies.every(
			(m) =>
				Array.isArray(m) &&
				m.length === 2 &&
				typeof m[0] === "number" &&
				typeof m[1] === "string",
		)
	) {
		console.error(
			`Config "${listName}.json" movies must be [tmdb id, name] tuples`,
		)
		process.exit(1)
	}

	const env = { ...loadEnv(), ...process.env }
	if (!env.TMDB_TOKEN && !env.TMDB_KEY) {
		console.error("Missing TMDB_TOKEN / TMDB_KEY (check .env)")
		process.exit(1)
	}

	const entries = []
	const misses = []
	for (const [id, name] of movies) {
		const entry = movieToEntry(id, name, await fetchMovie(env, id))
		if (!entry) {
			misses.push(`${name} (${id})`)
			console.error(`  no TMDB movie ${id} (${name})`)
		} else {
			entries.push(entry)
		}
	}

	const outPath = resolve(outDir, `${list.id}.json`)
	mkdirSync(outDir, { recursive: true })
	writeFileSync(
		outPath,
		JSON.stringify({ ...list, entries }, null, "\t") + "\n",
	)
	console.log(
		`Wrote ${entries.length}/${movies.length} films to ${outPath}` +
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
