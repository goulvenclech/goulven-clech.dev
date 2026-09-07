/**
 * Creates the catalogue's indexes; rerun after a table rebuild.
 *
 * Usage:
 *   node scripts/turso-indexes.mjs
 */
import { createClient } from "@libsql/client"
import { loadEnv } from "./listConfig.mjs"

// Each ends in the (inserted_at, id) order every listing uses, so SQLite can
// stop at LIMIT instead of sorting the whole table.
const INDEXES = [
	["reviews_inserted_at_id", "reviews (inserted_at, id)"],
	["reviews_source_inserted_at_id", "reviews (source, inserted_at, id)"],
	["reviews_rating_inserted_at_id", "reviews (rating, inserted_at, id)"],
]

const env = { ...loadEnv(), ...process.env }
if (!env.TURSO_URL || !env.TURSO_TOKEN) {
	console.error("TURSO_URL and TURSO_TOKEN are required (see .env)")
	process.exit(1)
}

async function main() {
	const client = createClient({
		url: env.TURSO_URL,
		authToken: env.TURSO_TOKEN,
	})
	for (const [name, definition] of INDEXES) {
		await client.execute(`CREATE INDEX IF NOT EXISTS ${name} ON ${definition}`)
		console.log(`ok  ${name}`)
	}
}

main().catch((err) => {
	console.error("Index creation failed:", err)
	process.exit(1)
})
