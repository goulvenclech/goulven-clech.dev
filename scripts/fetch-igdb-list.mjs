#!/usr/bin/env node
/**
 * Build a catalogue to-do list from IGDB games, resolving each title to its
 * canonical IGDB id (the id the catalogue keys `IGDB` reviews on).
 *
 * IGDB has no stable id lookup by name, so we search each title and pick the
 * candidate whose release year matches and whose name is closest, skipping the
 * fan edits / bundles that pollute search results. Configured below for the
 * Zelda marathon; edit LIST and GAMES to build a different IGDB list.
 *
 * Needs IGDB_ID / IGDB_SECRET in .env (Twitch app credentials).
 *
 * Usage:
 *   node scripts/fetch-igdb-list.mjs   # writes src/data/lists/<LIST.id>.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")
const outDir = resolve(projectRoot, "src/data/lists")

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const LIST = {
	id: "zelda-marathon",
	title: "Marathon Zelda",
	description:
		"A Legend of Zelda marathon with my friend Erika. Usually the most modern version of each game, though I keep a remake and its original apart when they differ enough to matter.",
	source: "IGDB",
	url: "https://en.wikipedia.org/wiki/The_Legend_of_Zelda",
}

// [display name, IGDB search query, release year]. Year disambiguates the many
// re-releases sharing a title (Ocarina of Time 1998 vs 3D 2011, etc.).
const GAMES = [
	["The Legend of Zelda", "The Legend of Zelda", 1986],
	["Zelda II: The Adventure of Link", "Zelda II The Adventure of Link", 1987],
	["A Link to the Past", "The Legend of Zelda A Link to the Past", 1991],
	["Link: The Faces of Evil", "Link The Faces of Evil", 1993],
	["Zelda: The Wand of Gamelon", "Zelda The Wand of Gamelon", 1993],
	["Zelda's Adventure", "Zelda's Adventure", 1994],
	["Link's Awakening DX", "The Legend of Zelda Link's Awakening DX", 1998],
	["Oracle of Seasons", "The Legend of Zelda Oracle of Seasons", 2001],
	["Oracle of Ages", "The Legend of Zelda Oracle of Ages", 2001],
	[
		"Four Swords Adventures",
		"The Legend of Zelda Four Swords Adventures",
		2004,
	],
	["The Minish Cap", "The Legend of Zelda The Minish Cap", 2004],
	["Phantom Hourglass", "The Legend of Zelda Phantom Hourglass", 2007],
	["Spirit Tracks", "The Legend of Zelda Spirit Tracks", 2009],
	["Ocarina of Time 3D", "The Legend of Zelda Ocarina of Time 3D", 2011],
	["The Wind Waker HD", "The Legend of Zelda The Wind Waker HD", 2013],
	["A Link Between Worlds", "The Legend of Zelda A Link Between Worlds", 2013],
	["Majora's Mask 3D", "The Legend of Zelda Majora's Mask 3D", 2015],
	["Tri Force Heroes", "The Legend of Zelda Tri Force Heroes", 2015],
	["Twilight Princess HD", "The Legend of Zelda Twilight Princess HD", 2016],
	["Breath of the Wild", "The Legend of Zelda Breath of the Wild", 2017],
	["Link's Awakening (2019)", "The Legend of Zelda Link's Awakening", 2019],
	["Skyward Sword HD", "The Legend of Zelda Skyward Sword HD", 2021],
	["Zelda 2 Redux", "Zelda 2 Redux", 2021],
	["The Legend of Zelda Redux", "The Legend of Zelda Redux", 2022],
	["Tears of the Kingdom", "The Legend of Zelda Tears of the Kingdom", 2023],
	["Echoes of Wisdom", "The Legend of Zelda Echoes of Wisdom", 2024],
]

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

/** Strip the series prefix and punctuation so titles compare on their distinctive part. */
export function normalizeName(name) {
	return name
		.toLowerCase()
		.replace(/the legend of zelda/g, "")
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

async function main() {
	const env = { ...loadEnv(), ...process.env }
	if (!env.IGDB_ID || !env.IGDB_SECRET) {
		console.error("Missing IGDB_ID / IGDB_SECRET (check .env)")
		process.exit(1)
	}
	const token = await getToken(env)

	const entries = []
	const misses = []
	for (const [name, query, year] of GAMES) {
		const game = pickMatch(await search(env, token, query), name, year)
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

	const outPath = resolve(outDir, `${LIST.id}.json`)
	mkdirSync(outDir, { recursive: true })
	writeFileSync(
		outPath,
		JSON.stringify({ ...LIST, entries }, null, "\t") + "\n",
	)
	console.log(
		`Wrote ${entries.length}/${GAMES.length} games to ${outPath}` +
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
