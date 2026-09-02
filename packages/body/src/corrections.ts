import {
	LOG_SCHEMA_VERSION,
	type LogEntry,
	type RetractionEntry,
} from "./schemas"

export function retractionOf(entry: LogEntry): RetractionEntry {
	return {
		kind: "retraction",
		schemaVersion: LOG_SCHEMA_VERSION,
		id: crypto.randomUUID(),
		date: entry.date,
		retracts: entry.id,
	}
}

export function liveEntries(log: readonly LogEntry[]): LogEntry[] {
	const retracted = new Set<string>()
	for (const entry of log)
		if (entry.kind === "retraction") retracted.add(entry.retracts)
	return log.filter(
		(entry) => entry.kind !== "retraction" && !retracted.has(entry.id),
	)
}
