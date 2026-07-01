#!/usr/bin/env node
/**
 * Export catalogue reviews to a Letterboxd-importable CSV.
 * Format: https://letterboxd.com/about/importing-data/
 *
 * The catalogue rates 1–6; Letterboxd caps at 5, so 6 (favorite) → 5.
 *
 * Usage:
 *   node scripts/export-letterboxd.mjs               # writes scripts/output/letterboxd-import.csv
 *   node scripts/export-letterboxd.mjs out.csv       # custom output path (relative to cwd)
 *   node scripts/export-letterboxd.mjs --tv          # export TV shows instead of movies
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { createClient } from "@libsql/client"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")
const outputDir = resolve(__dirname, "output")

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

/** Escapes a CSV field per RFC 4180 (quote if it contains comma, quote, or newline). */
function csvField(value) {
	const s = String(value ?? "")
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
	const env = { ...loadEnv(), ...process.env }
	const url = env.TURSO_URL
	const authToken = env.TURSO_TOKEN
	if (!url) {
		console.error("Missing TURSO_URL (check .env)")
		process.exit(1)
	}

	const args = process.argv.slice(2)
	const isTv = args.includes("--tv")
	const outArg = args.find((a) => !a.startsWith("--"))
	const source = isTv ? "TMDB_TV" : "TMDB_MOVIE"
	const defaultName = isTv ? "letterboxd-tv.csv" : "letterboxd-import.csv"
	const outPath = outArg
		? resolve(process.cwd(), outArg)
		: resolve(outputDir, defaultName)
	mkdirSync(dirname(outPath), { recursive: true })

	const client = createClient({ url, authToken })

	// Oldest-first so the CSV reads chronologically.
	const res = await client.execute({
		sql: `SELECT source_id, source_name, rating, inserted_at
		        FROM reviews
		       WHERE source = ?
		    ORDER BY inserted_at ASC`,
		args: [source],
	})

	const header = ["tmdbID", "Title", "Rating", "WatchedDate"]
	const lines = [header.join(",")]

	for (const row of res.rows) {
		// Catalogue rating 6 (favorite) collapses to Letterboxd's max of 5.
		const rating = Math.min(Number(row.rating), 5)
		// Letterboxd wants WatchedDate as YYYY-MM-DD; inserted_at is ISO-8601.
		const watchedDate = String(row.inserted_at ?? "").slice(0, 10)
		lines.push(
			[
				csvField(row.source_id),
				csvField(row.source_name),
				csvField(rating),
				csvField(watchedDate),
			].join(","),
		)
	}

	writeFileSync(outPath, lines.join("\n") + "\n", "utf8")
	console.log(`Wrote ${res.rows.length} ${source} reviews to ${outPath}`)
}

main().catch((err) => {
	console.error("Export failed:", err)
	process.exit(1)
})
