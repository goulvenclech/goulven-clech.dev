import { retractionOf } from "../corrections"
import { formatDayShort } from "../dates"
import {
	LOG_SCHEMA_VERSION,
	type ConditioningEntry,
	type LogEntry,
} from "../schemas"
import { el, inputValue, type Modal } from "./dom"
import { submitDialog } from "./submitDialog"
import { wellnessFields, type WellnessFields } from "./wellnessFields"

// Two days' workouts can share the log page, so each form labels its own fields.
let formCount = 0

function conditioningForm(options: {
	title: string
	submitLabel: string
	category: string
	date: string
	logged: ConditioningEntry | null
	wellness: WellnessFields | null
	onSettled: (note?: string) => void
}): Modal {
	const { category, date, logged } = options
	const suffix = ++formCount
	const workoutId = `workout-${suffix}`
	const levelId = `level-${suffix}`
	const setsId = `sets-${suffix}`
	const workout = el("input", {
		id: workoutId,
		class: "workout",
		type: "text",
		value: logged?.workout ?? category.toLowerCase(),
		required: "",
	})
	const level = el("input", {
		id: levelId,
		class: "level",
		type: "number",
		inputmode: "numeric",
		step: "1",
		min: "1",
		max: "5",
		required: "",
		value: inputValue(logged?.level),
	})
	const sets = el("input", {
		id: setsId,
		class: "sets",
		type: "number",
		inputmode: "numeric",
		step: "1",
		min: "1",
		required: "",
		value: inputValue(logged?.sets),
	})

	return submitDialog({
		title: options.title,
		submitLabel: options.submitLabel,
		fields: [
			el("div", {}, [el("label", { for: workoutId }, ["Workout"]), workout]),
			el("div", { class: "mt-6 flex gap-3" }, [
				el("div", { class: "flex-1" }, [
					el("label", { for: levelId }, ["Level"]),
					level,
				]),
				el("div", { class: "flex-1" }, [
					el("label", { for: setsId }, ["Sets"]),
					sets,
				]),
			]),
		],
		wellness: options.wellness,
		invalidMessage: "Could not save — check the workout, level (1–5) and sets.",
		onSettled: options.onSettled,
		build: (wellnessEntry, live) => {
			const entry: ConditioningEntry = {
				kind: "conditioning",
				schemaVersion: LOG_SCHEMA_VERSION,
				id: crypto.randomUUID(),
				date,
				category: logged?.category ?? category,
				workout: workout.value.trim(),
				level: Number(level.value),
				sets: Number(sets.value),
			}
			const unchanged =
				logged !== null &&
				entry.workout === logged.workout &&
				entry.level === logged.level &&
				entry.sets === logged.sets
			// The app means one workout a day: a second is two devices logging it.
			const standing = logged
				? live.filter(
						(candidate): candidate is ConditioningEntry =>
							candidate.kind === "conditioning" && candidate.date === date,
					)
				: []
			const entries: LogEntry[] = unchanged
				? []
				: [...standing.map(retractionOf), entry]
			if (wellnessEntry) entries.push(wellnessEntry)
			return { entries }
		},
	})
}

export function conditioningDialog(
	title: string,
	today: string,
	log: readonly LogEntry[],
	onSettled: (note?: string) => void,
): Modal {
	return conditioningForm({
		title,
		submitLabel: "Log workout",
		category: title,
		date: today,
		logged: null,
		wellness: wellnessFields(log, today),
		onSettled,
	})
}

export function conditioningEditDialog(
	title: string,
	date: string,
	logged: ConditioningEntry | null,
	onSettled: (note?: string) => void,
): Modal {
	return conditioningForm({
		title: `${title} · ${formatDayShort(date)}`,
		submitLabel: logged ? "Save workout" : "Log workout",
		category: title,
		date,
		logged,
		wellness: null,
		onSettled,
	})
}
