import {
	clearOutbox,
	mergeEntries,
	outboxEntries,
	pendingCount,
} from "../logStore"
import { LOG_SCHEMA_VERSION } from "../schemas"

/**
 * IndexedDB stays the source of truth; offline is a normal state, so every
 * network failure is swallowed.
 */

const API_BASE = import.meta.env.DEV
	? "http://localhost:4321"
	: "https://goulven-clech.dev"
const TOKEN_KEY = "body-sync-token"
// Versioned: a stale client drops entries it cannot parse, so newer code
// never trusts its cursor — each version re-pulls from scratch.
const CURSOR_KEY = `body-sync-cursor-v${LOG_SCHEMA_VERSION}`
const PAGE = 500

// localStorage can be absent or throw (private modes); sync then stays off.
const storageGet = (key: string): string | null => {
	try {
		return localStorage.getItem(key)
	} catch {
		return null
	}
}
const storageSet = (key: string, value: string): void => {
	try {
		localStorage.setItem(key, value)
	} catch {}
}
const storageRemove = (key: string): void => {
	try {
		localStorage.removeItem(key)
	} catch {}
}

export const syncToken = (): string | null => storageGet(TOKEN_KEY)

export type AuthResult = "ok" | "unauthorized" | "offline"

export async function requestSyncToken(password: string): Promise<AuthResult> {
	const response = await fetch(`${API_BASE}/api/body/auth`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ password }),
	}).catch(() => null)
	if (!response) return "offline"
	if (response.status === 401) return "unauthorized"
	if (!response.ok) return "offline"
	const body: unknown = await response.json().catch(() => null)
	const token = (body as { token?: unknown } | null)?.token
	if (typeof token !== "string") return "offline"
	storageSet(TOKEN_KEY, token)
	return "ok"
}

export interface SyncResult {
	pulled: number
	pushed: number
	pending: number
	/** True when pushes are held because no valid token is stored. */
	authRequired: boolean
	/** True when the server refused a batch; the entries stay local. */
	rejected: boolean
	/** True when the backend could not be reached at all. */
	offline: boolean
}

/** Push and pull are independent: a failing push must never block a pull. */
export async function sync(): Promise<SyncResult> {
	let pushed = 0
	let authRequired = false
	let rejected = false
	let offline = false
	try {
		;({ pushed, authRequired, rejected } = await push())
	} catch {
		offline = true
	}
	let pulled = 0
	try {
		pulled = await pull()
	} catch {
		offline = true
	}
	const pending = await pendingCount().catch(() => 0)
	return { pulled, pushed, pending, authRequired, rejected, offline }
}

async function push(): Promise<{
	pushed: number
	authRequired: boolean
	rejected: boolean
}> {
	const entries = await outboxEntries()
	if (entries.length === 0)
		return { pushed: 0, authRequired: false, rejected: false }
	const token = syncToken()
	if (!token) return { pushed: 0, authRequired: true, rejected: false }

	let pushed = 0
	for (let start = 0; start < entries.length; start += PAGE) {
		const batch = entries.slice(start, start + PAGE)
		const response = await fetch(`${API_BASE}/api/body/log`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ entries: batch }),
		})
		if (response.status === 401) {
			// A rotated password invalidates the token: ask for it again.
			storageRemove(TOKEN_KEY)
			return { pushed, authRequired: true, rejected: false }
		}
		if (!response.ok)
			// The server refused the batch (schema drift, oversized entry):
			// retrying can't fix it, and the data stays safe locally.
			return { pushed, authRequired: false, rejected: true }
		await clearOutbox(batch.map((entry) => entry.id))
		pushed += batch.length
	}
	return { pushed, authRequired: false, rejected: false }
}

async function pull(): Promise<number> {
	let cursor = Number(storageGet(CURSOR_KEY) ?? 0)
	if (!Number.isInteger(cursor) || cursor < 0) cursor = 0
	let added = 0
	for (;;) {
		const response = await fetch(`${API_BASE}/api/body/log?since=${cursor}`)
		if (!response.ok) throw new Error(`pull failed (${response.status})`)
		const body = (await response.json()) as {
			entries: unknown[]
			cursor: number
			max: number
		}
		if (body.entries.length === 0 && cursor > Number(body.max)) {
			// The server log was rebuilt and rowids restarted below the cursor:
			// re-pull from scratch — the by-id union converges.
			cursor = 0
			storageSet(CURSOR_KEY, "0")
			continue
		}
		added += await mergeEntries(body.entries, { queue: false })
		cursor = body.cursor
		storageSet(CURSOR_KEY, String(cursor))
		if (body.entries.length < PAGE) return added
	}
}
