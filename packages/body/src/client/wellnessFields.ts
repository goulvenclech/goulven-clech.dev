import { addDays, formatDayShort } from "../dates"
import { hoursOf } from "../duration"
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

const numberInput = (attributes: Record<string, string>) =>
	el("input", {
		type: "number",
		inputmode: "numeric",
		step: "1",
		...attributes,
	})

const enteredCount = (input: HTMLInputElement | null) =>
	input && input.value !== "" ? Number(input.value) : undefined

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

	const sleepHours = sleepLogged
		? null
		: numberInput({
				id: "sleep",
				class: "wellness-sleep",
				min: "0",
				// With the minutes capped at 59, no pair can exceed the stored max.
				max: "23",
				placeholder: "h",
				"aria-label": "Sleep hours",
			})
	const sleepMinutes = sleepLogged
		? null
		: numberInput({
				class: "wellness-sleep-minutes",
				min: "0",
				max: "59",
				placeholder: "min",
				"aria-label": "Sleep minutes",
			})
	const steps = stepsLogged
		? null
		: numberInput({ id: "steps", class: "wellness-steps", min: "1" })

	const sleep =
		sleepHours && sleepMinutes
			? el("div", { class: "flex gap-2" }, [sleepHours, sleepMinutes])
			: null

	const field = (
		control: Node | null,
		label: string,
		id: string,
		width: string,
	) =>
		control
			? [
					el("div", { class: width }, [
						el("label", { for: id }, [label]),
						control,
					]),
				]
			: []

	const element = el("fieldset", { class: "wellness mt-6" }, [
		el("legend", {}, [`Yesterday — ${formatDayShort(yesterday)}`]),
		el("div", { class: "flex gap-3" }, [
			...field(sleep, "Sleep (h / min)", "sleep", "flex-2"),
			...field(steps, "Steps", "steps", "flex-1"),
		]),
	])

	const entry = (): WellnessEntry | null => {
		const slept = hoursOf(
			enteredCount(sleepHours) ?? 0,
			enteredCount(sleepMinutes) ?? 0,
		)
		const stepCount = enteredCount(steps)
		if (slept === 0 && stepCount === undefined) return null
		return {
			kind: "wellness",
			schemaVersion: LOG_SCHEMA_VERSION,
			id: crypto.randomUUID(),
			date: yesterday,
			...(slept === 0 ? {} : { sleepHours: slept }),
			...(stepCount === undefined ? {} : { steps: stepCount }),
		}
	}

	return { element, entry }
}
