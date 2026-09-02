import { API_BASE } from "./apiBase"
import { liveEntries } from "./corrections"
import { logEntrySchema, type LogEntry } from "./schemas"

export async function fetchLog(
	fetchFn: typeof fetch = fetch,
): Promise<{ entries: LogEntry[]; unreadable: number }> {
	const entries: LogEntry[] = []
	let unreadable = 0
	let cursor = 0
	for (;;) {
		const response = await fetchFn(`${API_BASE}/api/body/log?since=${cursor}`)
		if (!response.ok) throw new Error(`log fetch failed (${response.status})`)
		const body = (await response.json()) as {
			entries: unknown[]
			cursor: number
			max: number
		}
		for (const raw of body.entries) {
			const parsed = logEntrySchema.safeParse(raw)
			if (parsed.success) entries.push(parsed.data)
			else unreadable += 1
		}
		const next = Number(body.cursor)
		const max = Number(body.max)
		// A malformed response (NaN compares false) or a cursor that stops
		// advancing must end the loop rather than spin it.
		if (!Number.isFinite(next) || !Number.isFinite(max) || next <= cursor) break
		cursor = next
		if (cursor >= max) break
	}
	return { entries: liveEntries(entries), unreadable }
}
