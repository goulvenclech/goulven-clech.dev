import { createClient, type Client } from "@libsql/client"
import { TURSO_TOKEN, TURSO_URL } from "astro:env/server"

export type { Client }

export function getClient(): Client {
	return createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })
}
