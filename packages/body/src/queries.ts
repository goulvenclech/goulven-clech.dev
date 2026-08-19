import type { Client } from "@libsql/client"
import type { SessionKind } from "./program"
import type {
	SessionInput,
	SessionStatus,
	SkipReason,
} from "./sessionValidation"

export interface SessionRow {
	id: number
	date: string
	// Narrowed types are safe: the schema CHECK-constrains these columns.
	kind: SessionKind
	status: SessionStatus
	skip_reason: SkipReason | null
	notes: string
	inserted_at: string
}

export interface SetRow {
	session_id: number
	exercise: string
	pattern: string
	weight_kg: number | null
	reps: number
	set_index: number
}

export interface DatedSetRow extends SetRow {
	date: string
}

/**
 * Projected field by field rather than spread, so widening the table can't
 * silently widen what callers receive.
 */
const mapSession = (row: SessionRow): SessionRow => ({
	id: Number(row.id),
	date: row.date,
	kind: row.kind,
	status: row.status,
	skip_reason: row.skip_reason,
	notes: row.notes ?? "",
	inserted_at: row.inserted_at,
})

const mapSet = (row: SetRow): SetRow => ({
	session_id: Number(row.session_id),
	exercise: row.exercise,
	pattern: row.pattern,
	weight_kg: row.weight_kg,
	reps: Number(row.reps),
	set_index: Number(row.set_index),
})

const SESSION_COLUMNS =
	"id, date, kind, status, skip_reason, notes, inserted_at"

export async function getSessionByDate(
	client: Client,
	date: string,
): Promise<SessionRow | null> {
	const res = await client.execute({
		sql: `SELECT ${SESSION_COLUMNS} FROM sessions WHERE date = ?`,
		args: [date],
	})
	const rows = res.rows as unknown as SessionRow[]
	return rows.length > 0 ? mapSession(rows[0]) : null
}

export async function listSessions(
	client: Client,
	limit: number,
	offset = 0,
): Promise<SessionRow[]> {
	const res = await client.execute({
		sql: `SELECT ${SESSION_COLUMNS} FROM sessions
		      ORDER BY date DESC LIMIT ? OFFSET ?`,
		args: [limit, offset],
	})
	return (res.rows as unknown as SessionRow[]).map(mapSession)
}

export async function listSessionsSince(
	client: Client,
	from: string,
): Promise<SessionRow[]> {
	const res = await client.execute({
		sql: `SELECT ${SESSION_COLUMNS} FROM sessions WHERE date >= ? ORDER BY date`,
		args: [from],
	})
	return (res.rows as unknown as SessionRow[]).map(mapSession)
}

export async function listSetsForSessions(
	client: Client,
	sessionIds: number[],
): Promise<SetRow[]> {
	if (sessionIds.length === 0) return []
	const placeholders = sessionIds.map(() => "?").join(", ")
	const res = await client.execute({
		sql: `SELECT session_id, exercise, pattern, weight_kg, reps, set_index
		      FROM session_sets WHERE session_id IN (${placeholders})
		      ORDER BY session_id, set_index`,
		args: sessionIds,
	})
	return (res.rows as unknown as SetRow[]).map(mapSet)
}

export async function listSetsSince(
	client: Client,
	from: string,
): Promise<DatedSetRow[]> {
	const res = await client.execute({
		sql: `SELECT s.date, ss.session_id, ss.exercise, ss.pattern,
		             ss.weight_kg, ss.reps, ss.set_index
		      FROM session_sets ss
		      JOIN sessions s ON s.id = ss.session_id
		      WHERE s.date >= ?
		      ORDER BY s.date, ss.set_index`,
		args: [from],
	})
	return (res.rows as unknown as DatedSetRow[]).map((row) => ({
		...mapSet(row),
		date: row.date,
	}))
}

/** Inserts a session and its sets atomically; returns the new session id. */
export async function insertSession(
	client: Client,
	session: SessionInput,
): Promise<number> {
	const tx = await client.transaction("write")
	try {
		const res = await tx.execute({
			sql: `INSERT INTO sessions (date, kind, status, skip_reason, notes, inserted_at)
			      VALUES (?, ?, ?, ?, ?, ?)`,
			args: [
				session.date,
				session.kind,
				session.status,
				session.skip_reason,
				session.notes,
				new Date().toISOString(),
			],
		})
		const id = Number(res.lastInsertRowid)
		for (const [index, set] of session.sets.entries())
			await tx.execute({
				sql: `INSERT INTO session_sets (session_id, exercise, pattern, weight_kg, reps, set_index)
				      VALUES (?, ?, ?, ?, ?, ?)`,
				args: [
					id,
					set.exercise,
					set.pattern,
					set.weight_kg,
					set.reps,
					index + 1,
				],
			})
		await tx.commit()
		return id
	} finally {
		// A no-op after commit; rolls back if anything above threw.
		tx.close()
	}
}
