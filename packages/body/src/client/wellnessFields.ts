import { addDays, formatDayShort } from "../dates"
import {
	LOG_SCHEMA_VERSION,
	type LogEntry,
	type WellnessEntry,
} from "../schemas"
import { el } from "./dom"

export interface WellnessFields {
	element: HTMLElement
	/** The entry the filled inputs describe, or null when all left blank. */
	entry: () => WellnessEntry | null
}

/**
 * The log is append-only, so each metric disappears once logged; once both
 * are, the whole block does (null).
 */
export function wellnessFields(
	log: readonly LogEntry[],
	today: string,
): WellnessFields | null {
	const yesterday = addDays(today, -1)
	let sleepLogged = false
	let stepsLogged = false
	for (const entry of log) {
		if (entry.kind !== "wellness" || entry.date !== yesterday) continue
		if (entry.sleepHours !== undefined) sleepLogged = true
		if (entry.steps !== undefined) stepsLogged = true
	}
	if (sleepLogged && stepsLogged) return null

	const sleep = sleepLogged
		? null
		: el("input", {
				id: "sleep",
				class: "wellness-sleep",
				type: "number",
				inputmode: "decimal",
				step: "any",
				min: "0.1",
				max: "24",
			})
	const steps = stepsLogged
		? null
		: el("input", {
				id: "steps",
				class: "wellness-steps",
				type: "number",
				inputmode: "numeric",
				step: "1",
				min: "1",
			})

	const field = (input: HTMLInputElement | null, label: string) =>
		input
			? [
					el("div", { class: "flex-1" }, [
						el("label", { for: input.id }, [label]),
						input,
					]),
				]
			: []

	const element = el("fieldset", { class: "wellness mt-6" }, [
		el("legend", {}, [`Yesterday — ${formatDayShort(yesterday)}`]),
		el("div", { class: "flex gap-3" }, [
			...field(sleep, "Sleep (h)"),
			...field(steps, "Steps"),
		]),
	])

	const entry = (): WellnessEntry | null => {
		const sleepHours =
			sleep && sleep.value !== "" ? Number(sleep.value) : undefined
		const stepCount =
			steps && steps.value !== "" ? Number(steps.value) : undefined
		if (sleepHours === undefined && stepCount === undefined) return null
		return {
			kind: "wellness",
			schemaVersion: LOG_SCHEMA_VERSION,
			id: crypto.randomUUID(),
			date: yesterday,
			...(sleepHours === undefined ? {} : { sleepHours }),
			...(stepCount === undefined ? {} : { steps: stepCount }),
		}
	}

	return { element, entry }
}
