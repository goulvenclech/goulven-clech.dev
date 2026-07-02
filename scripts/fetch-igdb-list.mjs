#!/usr/bin/env node
/**
 * Build a catalogue to-do list from IGDB games, resolving each title to its
 * canonical IGDB id (the id the catalogue keys `IGDB` reviews on).
 *
 * IGDB has no stable id lookup by name, so we search each title and pick the
 * candidate whose release year matches and whose name is closest, skipping the
 * fan edits / bundles that pollute search results.
 *
 * Each list is a config at scripts/igdb-lists/<name>.json holding the list
 * metadata plus a `games` array of [display name, IGDB search query, year] —
 * the year disambiguating the many re-releases that share a title. Needs
 * IGDB_ID / IGDB_SECRET in .env (Twitch app credentials).
 *
 * Usage:
 *   node scripts/fetch-igdb-list.mjs --list zelda-marathon
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")
const outDir = resolve(projectRoot, "src/data/lists")
const configDir = resolve(__dirname, "igdb-lists")

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Editions and fan projects that share a title but aren't the game we want. */
const EXCLUDE =
	/randomizer|master quest|expansion|first edition|limited edition|artbook|dreamer|bonus|two game|coop|stamina|gold quest| 2d|unreal|online/

/** Minimal .env reader, to avoid a dotenv dependency. */
function loadEnv() {
	const env = {}
	let raw
	try {
		raw = readFileSync(resolve(projectRoot, ".env"), "utf8")
	} catch {
		return env
	}
	for (const line of raw.split("\n")) {
		const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
		if (!m) continue
		let val = m[2].trim()
		if (
			(val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'"))
		)
			val = val.slice(1, -1)
		env[m[1]] = val
	}
	return env
}

export function yearOf(game) {
	return game.first_release_date
		? new Date(game.first_release_date * 1000).getUTCFullYear()
		: null
}

/** Strip series prefixes, the "Version" suffix, and punctuation so titles compare on their distinctive part. */
export function normalizeName(name) {
	return name
		.toLowerCase()
		.replace(/the legend of zelda|version/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
}

export function coverUrl(imageId, size = "cover_big_2x") {
	return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`
}

/** Best candidate for an expected title and year, or null when nothing fits. */
export function pickMatch(candidates, expectedName, year) {
	const expected = normalizeName(expectedName)
	const sameYear = candidates.filter((g) => yearOf(g) === year)
	const pool = (sameYear.length ? sameYear : candidates).filter(
		(g) => !EXCLUDE.test(normalizeName(g.name)),
	)
	const scored = pool
		.map((g) => {
			const name = normalizeName(g.name)
			let score = 0
			if (name === expected) score += 100
			else if (name.includes(expected) || expected.includes(name)) score += 40
			if (g.cover) score += 10
			score -= Math.abs(name.length - expected.length) / 10
			return { g, score }
		})
		.sort((a, b) => b.score - a.score)
	return scored[0]?.g ?? null
}

async function getToken(env) {
	const res = await fetch(
		`https://id.twitch.tv/oauth2/token?client_id=${env.IGDB_ID}&client_secret=${env.IGDB_SECRET}&grant_type=client_credentials`,
		{ method: "POST" },
	)
	if (!res.ok) throw new Error(`Twitch token failed: HTTP ${res.status}`)
	return (await res.json()).access_token
}

async function search(env, token, query) {
	const res = await fetch("https://api.igdb.com/v4/games", {
		method: "POST",
		headers: { "Client-ID": env.IGDB_ID, Authorization: `Bearer ${token}` },
		body: `fields id,name,slug,first_release_date,cover.image_id; search "${query}"; limit 30;`,
	})
	if (!res.ok) throw new Error(`IGDB search failed: HTTP ${res.status}`)
	return res.json()
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
	// Keep --list to a bare config name; it becomes a filesystem path below.
	if (!listName || /[/\\]|\.\./.test(listName)) {
		console.error(
			`Usage: node scripts/fetch-igdb-list.mjs --list <name>\n` +
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
	const { games, ...list } = config
	if (!list.id || !Array.isArray(games) || games.length === 0) {
		console.error(
			`Config "${listName}.json" needs an id and a non-empty games array`,
		)
		process.exit(1)
	}
	if (
		!games.every(
			(g) =>
				Array.isArray(g) &&
				g.length === 3 &&
				typeof g[1] === "string" &&
				typeof g[2] === "number",
		)
	) {
		console.error(
			`Config "${listName}.json" games must be [name, query, year] tuples`,
		)
		process.exit(1)
	}

	const env = { ...loadEnv(), ...process.env }
	if (!env.IGDB_ID || !env.IGDB_SECRET) {
		console.error("Missing IGDB_ID / IGDB_SECRET (check .env)")
		process.exit(1)
	}
	const token = await getToken(env)

	const entries = []
	const misses = []
	for (const [name, query, year] of games) {
		// Match on the search query (a specific edition), not the display name.
		const game = pickMatch(await search(env, token, query), query, year)
		if (!game) {
			misses.push(`${name} (${year})`)
			console.error(`  no match: ${name} (${year})`)
		} else {
			entries.push({
				id: game.id,
				name,
				year,
				poster: game.cover ? coverUrl(game.cover.image_id) : null,
				link: `https://www.igdb.com/games/${game.slug}`,
			})
		}
		await sleep(260)
	}

	const outPath = resolve(outDir, `${list.id}.json`)
	mkdirSync(outDir, { recursive: true })
	writeFileSync(
		outPath,
		JSON.stringify({ ...list, entries }, null, "\t") + "\n",
	)
	console.log(
		`Wrote ${entries.length}/${games.length} games to ${outPath}` +
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
