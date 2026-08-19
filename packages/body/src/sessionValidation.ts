import { isDateString } from "./dates"
import {
	exerciseBySlug,
	programFor,
	type MovementPattern,
	type SessionKind,
} from "./program"

export const SESSION_STATUSES = ["completed", "partial", "skipped"] as const
export type SessionStatus = (typeof SESSION_STATUSES)[number]

export const SKIP_REASONS = ["sick", "holiday", "lazy", "social"] as const
export type SkipReason = (typeof SKIP_REASONS)[number]

export interface SetInput {
	exercise: string
	pattern: MovementPattern
	weight_kg: number | null
	reps: number
}

export interface SessionInput {
	date: string
	kind: SessionKind
	status: SessionStatus
	skip_reason: SkipReason | null
	notes: string
	sets: SetInput[]
}

export type ParseResult =
	{ ok: true; session: SessionInput } | { ok: false; error: string }

const MAX_SETS = 50
const MAX_NOTES_LENGTH = 2000
const MAX_WEIGHT_KG = 500
const MAX_REPS = 100

const invalid = (error: string): ParseResult => ({ ok: false, error })

function parseSet(value: unknown): SetInput | string {
	if (typeof value !== "object" || value === null) return "Malformed set"
	const { exercise, weight_kg, reps } = value as Record<string, unknown>

	const known = typeof exercise === "string" ? exerciseBySlug(exercise) : null
	if (!known) return "Unknown exercise"

	if (
		!Number.isInteger(reps) ||
		(reps as number) < 1 ||
		(reps as number) > MAX_REPS
	)
		return `Reps must be an integer between 1 and ${MAX_REPS}`

	// Absent or null weight means bodyweight work.
	let weight: number | null = null
	if (weight_kg !== undefined && weight_kg !== null) {
		if (
			typeof weight_kg !== "number" ||
			!Number.isFinite(weight_kg) ||
			weight_kg <= 0 ||
			weight_kg > MAX_WEIGHT_KG
		)
			return `Weight must be above 0 and at most ${MAX_WEIGHT_KG} kg`
		weight = weight_kg
	}

	return {
		exercise: known.slug,
		pattern: known.pattern,
		weight_kg: weight,
		reps: reps as number,
	}
}

/**
 * `today` is the current date in the app's time zone: backfilling past days
 * is allowed, logging the future is not.
 */
export function parseSessionPayload(body: unknown, today: string): ParseResult {
	if (typeof body !== "object" || body === null) return invalid("Bad Request")
	const { date, status, skip_reason, notes, sets } = body as Record<
		string,
		unknown
	>

	if (!isDateString(date)) return invalid("Invalid date")
	if (date > today) return invalid("Cannot log a future session")

	const day = programFor(date)
	if (day.kind === "rest") return invalid("Rest days have nothing to log")

	if (!SESSION_STATUSES.includes(status as SessionStatus))
		return invalid("Invalid status")
	const parsedStatus = status as SessionStatus

	let parsedReason: SkipReason | null = null
	if (parsedStatus === "skipped") {
		if (!SKIP_REASONS.includes(skip_reason as SkipReason))
			return invalid("A skipped session needs a reason")
		parsedReason = skip_reason as SkipReason
	} else if (skip_reason !== undefined && skip_reason !== null) {
		return invalid("Only skipped sessions take a reason")
	}

	if (notes !== undefined && notes !== null && typeof notes !== "string")
		return invalid("Invalid notes")
	const parsedNotes = typeof notes === "string" ? notes : ""
	if (parsedNotes.length > MAX_NOTES_LENGTH) return invalid("Notes too long")

	const parsedSets: SetInput[] = []
	if (sets !== undefined) {
		if (!Array.isArray(sets) || sets.length > MAX_SETS)
			return invalid("Invalid sets")
		if (parsedStatus === "skipped" && sets.length > 0)
			return invalid("A skipped session cannot have sets")
		for (const set of sets) {
			const parsed = parseSet(set)
			if (typeof parsed === "string") return invalid(parsed)
			parsedSets.push(parsed)
		}
	}

	return {
		ok: true,
		session: {
			date,
			kind: day.kind,
			status: parsedStatus,
			skip_reason: parsedReason,
			notes: parsedNotes,
			sets: parsedSets,
		},
	}
}
