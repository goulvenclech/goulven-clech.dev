import type { MovementPattern, SessionKind } from "./program"
import type { SessionStatus, SkipReason } from "./sessionValidation"

export const KIND_LABELS: Record<SessionKind, string> = {
	strength: "Full Body Strength",
	cardio: "Cardio",
	combat: "Combat",
	core: "Core",
	rest: "Rest",
}

export const STATUS_LABELS: Record<SessionStatus, string> = {
	completed: "Done",
	partial: "Done, with misses",
	skipped: "Skipped",
}

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
	sick: "Sick",
	holiday: "Holiday",
	lazy: "Couldn't be bothered",
	social: "Social sport instead",
}

export const PATTERN_LABELS: Record<MovementPattern, string> = {
	squat: "Squat",
	hinge: "Hinge",
	push: "Push",
	pull: "Pull",
	core: "Core",
	conditioning: "Conditioning",
}
