import {
	LOG_SCHEMA_VERSION,
	type ConditioningEntry,
	type LogEntry,
} from "../schemas"
import { el, type Modal } from "./dom"
import { submitDialog } from "./submitDialog"

export function conditioningDialog(
	title: string,
	today: string,
	log: readonly LogEntry[],
	onSettled: (note?: string) => void,
): Modal {
	const workout = el("input", {
		id: "workout",
		type: "text",
		value: title.toLowerCase(),
		required: "",
	})
	const level = el("input", {
		id: "level",
		type: "number",
		inputmode: "numeric",
		step: "1",
		min: "1",
		max: "5",
		required: "",
	})
	const sets = el("input", {
		id: "sets",
		type: "number",
		inputmode: "numeric",
		step: "1",
		min: "1",
		required: "",
	})

	return submitDialog({
		title,
		submitLabel: "Log workout",
		fields: [
			el("div", {}, [el("label", { for: "workout" }, ["Workout"]), workout]),
			el("div", { class: "mt-6 flex gap-3" }, [
				el("div", { class: "flex-1" }, [
					el("label", { for: "level" }, ["Level"]),
					level,
				]),
				el("div", { class: "flex-1" }, [
					el("label", { for: "sets" }, ["Sets"]),
					sets,
				]),
			]),
		],
		log,
		today,
		invalidMessage: "Could not save — check the workout, level (1–5) and sets.",
		onSettled,
		build: (wellnessEntry) => {
			const entry: ConditioningEntry = {
				kind: "conditioning",
				schemaVersion: LOG_SCHEMA_VERSION,
				id: crypto.randomUUID(),
				date: today,
				category: title,
				workout: workout.value.trim(),
				level: Number(level.value),
				sets: Number(sets.value),
			}
			return { entries: wellnessEntry ? [entry, wellnessEntry] : [entry] }
		},
	})
}
