import { createClient, type Client } from "@libsql/client"

export type { Client }

// Single source of truth for the Turso connection config.
export function getClient(): Client {
	return createClient({
		url: import.meta.env.TURSO_URL,
		authToken: import.meta.env.TURSO_TOKEN,
	})
}
