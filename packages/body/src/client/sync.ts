import { API_BASE, LOG_PAGE } from "../apiBase"
import {
	clearOutbox,
	mergeEntries,
	outboxEntries,
	pendingCount,
	recordPushFailure,
} from "../logStore"
import { LOG_WIRE_VERSION } from "../schemas"

/**
 * IndexedDB stays the source of truth; offline is a normal state, so every
 * network failure is swallowed.
 */

const TOKEN_KEY = "body-sync-token"
const CURSOR_KEY = `body-sync-cursor-v${LOG_WIRE_VERSION}`
const ABANDONED_KEY = "body-sync-abandoned"
// Only a refusal of the data itself is given up on; an outage answers 5xx
// and keeps its place in the queue.
const PUSH_ATTEMPTS = 3
const RETRYABLE = new Set([408, 429])

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

/**
 * Entries given up on since the last call. Kept across loads: the push that
 * crosses the limit is usually fired by a screen with nowhere to say so.
 */
export function takeAbandoned(): number {
	const stored = Number(storageGet(ABANDONED_KEY) ?? 0)
	storageRemove(ABANDONED_KEY)
	return Number.isInteger(stored) && stored > 0 ? stored : 0
}

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
	/** Entries given up on after too many refusals; they stay local for good. */
	abandoned: number
	/** True when the backend could not be reached at all. */
	offline: boolean
}

/** Push and pull are independent: a failing push must never block a pull. */
export async function sync(): Promise<SyncResult> {
	let pushed = 0
	let authRequired = false
	let rejected = false
	let abandoned = 0
	let offline = false
	try {
		;({ pushed, authRequired, rejected, abandoned } = await push())
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
	return { pulled, pushed, pending, authRequired, rejected, abandoned, offline }
}

async function push(): Promise<{
	pushed: number
	authRequired: boolean
	rejected: boolean
	abandoned: number
}> {
	const entries = await outboxEntries()
	if (entries.length === 0)
		return { pushed: 0, authRequired: false, rejected: false, abandoned: 0 }
	const token = syncToken()
	if (!token)
		return { pushed: 0, authRequired: true, rejected: false, abandoned: 0 }

	let pushed = 0
	for (let start = 0; start < entries.length; start += LOG_PAGE) {
		const batch = entries.slice(start, start + LOG_PAGE)
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
			return { pushed, authRequired: true, rejected: false, abandoned: 0 }
		}
		if (!response.ok) {
			const permanent = response.status < 500 && !RETRYABLE.has(response.status)
			const abandoned = permanent
				? await recordPushFailure(
						batch.map((entry) => entry.id),
						PUSH_ATTEMPTS,
					)
				: 0
			if (abandoned > 0)
				storageSet(
					ABANDONED_KEY,
					String(Number(storageGet(ABANDONED_KEY) ?? 0) + abandoned),
				)
			return { pushed, authRequired: false, rejected: true, abandoned }
		}
		await clearOutbox(batch.map((entry) => entry.id))
		pushed += batch.length
	}
	return { pushed, authRequired: false, rejected: false, abandoned: 0 }
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
		added += await mergeEntries(body.entries)
		const next = Number(body.cursor)
		const max = Number(body.max)
		// A malformed response (NaN compares false) or a cursor that stops
		// advancing must end the loop, and never be persisted.
		if (!Number.isFinite(next) || !Number.isFinite(max) || next <= cursor)
			return added
		cursor = next
		storageSet(CURSOR_KEY, String(cursor))
		if (cursor >= max) return added
	}
}
