import { SESSIONS } from "./program"
import type {
	ConditioningEntry,
	LogEntry,
	StrengthEntry,
	WellnessEntry,
} from "./schemas"

export interface DayLog {
	date: string
	labels: string[]
	strength: { ref: string; sets: StrengthEntry[] }[]
	conditioning: ConditioningEntry[]
	wellness: WellnessEntry[]
}

export function formatSet(set: {
	kg: number
	reps: number
	unit?: "reps" | "m" | "s"
}): string {
	const unit = set.unit ?? "reps"
	if (unit === "reps") return `${set.kg} kg × ${set.reps}`
	return set.kg > 0
		? `${set.kg} kg × ${set.reps} ${unit}`
		: `${set.reps} ${unit}`
}

export function conditioningSummary(entry: ConditioningEntry): string {
	return `level ${entry.level} · ${entry.sets} sets`
}

export function wellnessSummary(entry: WellnessEntry): string {
	return [
		...(entry.sleepHours === undefined ? [] : [`${entry.sleepHours} h sleep`]),
		...(entry.steps === undefined ? [] : [`${entry.steps} steps`]),
	].join(" · ")
}

// The log carries no time of day, so the templates are the only stable order.
const plannedOrder = (entry: StrengthEntry) => {
	const index = SESSIONS[entry.session]?.exercises.findIndex(
		(planned) => planned.ref === entry.ref,
	)
	return index === undefined || index < 0 ? Number.MAX_SAFE_INTEGER : index
}

/** Days newest first — ISO dates sort lexicographically. */
export function groupByDay(log: LogEntry[]): DayLog[] {
	const byDate = new Map<string, LogEntry[]>()
	for (const entry of log) {
		const day = byDate.get(entry.date) ?? []
		day.push(entry)
		byDate.set(entry.date, day)
	}
	return [...byDate.entries()]
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([date, entries]) => dayOf(date, entries))
}

function dayOf(date: string, entries: LogEntry[]): DayLog {
	const strength = entries
		.filter((entry): entry is StrengthEntry => entry.kind === "strength")
		.sort(
			(a, b) =>
				a.session.localeCompare(b.session) ||
				plannedOrder(a) - plannedOrder(b) ||
				a.set - b.set,
		)
	const conditioning = entries
		.filter(
			(entry): entry is ConditioningEntry => entry.kind === "conditioning",
		)
		.sort(
			(a, b) =>
				a.category.localeCompare(b.category) ||
				a.workout.localeCompare(b.workout),
		)
	const wellness = entries.filter(
		(entry): entry is WellnessEntry => entry.kind === "wellness",
	)

	const byExercise = new Map<string, StrengthEntry[]>()
	for (const entry of strength) {
		const sets = byExercise.get(entry.ref) ?? []
		sets.push(entry)
		byExercise.set(entry.ref, sets)
	}

	return {
		date,
		labels: [
			...new Set([
				...(strength.length > 0 ? ["Strength"] : []),
				...conditioning.map((entry) => entry.category),
			]),
		],
		strength: [...byExercise.entries()].map(([ref, sets]) => ({ ref, sets })),
		conditioning,
		wellness,
	}
}
