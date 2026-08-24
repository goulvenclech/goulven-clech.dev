import { logEntrySchema, type LogEntry } from "./schemas"

/**
 * IndexedDB adapter for the append-only log — the only persisted runtime
 * state. Deliberately no update or delete: history is written once and only
 * ever read back.
 */

const DB_NAME = "body"
const DB_VERSION = 2
const STORE = "log"
const OUTBOX = "outbox"

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)
		request.onupgradeneeded = () => {
			const db = request.result
			// Version 1 predates entry ids and the outbox; it never shipped
			// beyond dev profiles, so recreate rather than migrate.
			if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE)
			db.createObjectStore(STORE, { keyPath: "id" })
			if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX)
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

function settled(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve()
		transaction.onerror = () => reject(transaction.error)
		transaction.onabort = () => reject(transaction.error)
	})
}

function result<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

/**
 * At most once per page load: Firefox surfaces persist() as a permission
 * prompt, and a dismissed one would otherwise reappear on every save.
 */
let persistenceRequested = false
function requestPersistenceOnce(): void {
	if (persistenceRequested) return
	persistenceRequested = true
	void globalThis.navigator?.storage?.persist?.().catch(() => {})
}

/** New local entries only: a reused id fails loudly. Queued for push. */
export async function appendEntries(
	entries: readonly LogEntry[],
): Promise<void> {
	// Validate where data enters storage, so a UI bug can't poison the log.
	const parsed = entries.map((entry) => logEntrySchema.parse(entry))
	requestPersistenceOnce()
	const db = await openDatabase()
	try {
		const transaction = db.transaction([STORE, OUTBOX], "readwrite")
		const store = transaction.objectStore(STORE)
		const outbox = transaction.objectStore(OUTBOX)
		for (const entry of parsed) {
			store.add(entry)
			outbox.put(0, entry.id)
		}
		await settled(transaction)
	} finally {
		db.close()
	}
}

/**
 * Union by id, returning how many entries were new. Nothing is queued for
 * push: merged entries only ever come from a pull, so they are already
 * upstream.
 */
export async function mergeEntries(
	candidates: readonly unknown[],
): Promise<number> {
	const valid = candidates.flatMap((candidate) => {
		const parsed = logEntrySchema.safeParse(candidate)
		return parsed.success ? [parsed.data] : []
	})
	if (valid.length === 0) return 0

	const db = await openDatabase()
	try {
		const transaction = db.transaction(STORE, "readwrite")
		const store = transaction.objectStore(STORE)
		const existing = new Set(await result(store.getAllKeys()))
		let added = 0
		for (const entry of valid) {
			if (existing.has(entry.id)) continue
			store.put(entry)
			added++
		}
		await settled(transaction)
		return added
	} finally {
		db.close()
	}
}

export async function readLog(): Promise<LogEntry[]> {
	const db = await openDatabase()
	try {
		return await result(
			db.transaction(STORE, "readonly").objectStore(STORE).getAll(),
		)
	} finally {
		db.close()
	}
}

/** Entries waiting to be pushed to the sync backend. */
export async function outboxEntries(): Promise<LogEntry[]> {
	const db = await openDatabase()
	try {
		const transaction = db.transaction([STORE, OUTBOX], "readonly")
		const store = transaction.objectStore(STORE)
		const ids = await result(
			transaction.objectStore(OUTBOX).getAllKeys() as IDBRequest<string[]>,
		)
		const entries = await Promise.all(
			ids.map((id) => result(store.get(id) as IDBRequest<LogEntry>)),
		)
		// An outbox id without its entry should never happen; skip defensively.
		return entries.filter(Boolean)
	} finally {
		db.close()
	}
}

/**
 * Entries that reach `limit` refusals leave the outbox but stay in the log.
 * Returns how many were given up on.
 */
export async function recordPushFailure(
	ids: readonly string[],
	limit: number,
): Promise<number> {
	const db = await openDatabase()
	try {
		const transaction = db.transaction(OUTBOX, "readwrite")
		const outbox = transaction.objectStore(OUTBOX)
		const counted = await Promise.all(
			ids.map((id) => result(outbox.get(id) as IDBRequest<unknown>)),
		)
		let abandoned = 0
		ids.forEach((id, index) => {
			const stored = counted[index]
			// A concurrent push may have cleared it; do not queue it again.
			if (stored === undefined) return
			const attempts = typeof stored === "number" ? stored + 1 : 1
			if (attempts >= limit) {
				outbox.delete(id)
				abandoned++
			} else outbox.put(attempts, id)
		})
		await settled(transaction)
		return abandoned
	} finally {
		db.close()
	}
}

export async function clearOutbox(ids: readonly string[]): Promise<void> {
	const db = await openDatabase()
	try {
		const transaction = db.transaction(OUTBOX, "readwrite")
		const outbox = transaction.objectStore(OUTBOX)
		for (const id of ids) outbox.delete(id)
		await settled(transaction)
	} finally {
		db.close()
	}
}

export async function pendingCount(): Promise<number> {
	const db = await openDatabase()
	try {
		return await result(
			db.transaction(OUTBOX, "readonly").objectStore(OUTBOX).count(),
		)
	} finally {
		db.close()
	}
}
