import { addDays, formatDayShort } from "../dates"
import type { LogEntry, WellnessEntry } from "../schemas"
import { el } from "./dom"
import {
	sleepHoursInput,
	sleepMinutesInput,
	stepsInput,
	wellnessEntryFrom,
} from "./wellnessInputs"

// Logging and skipping can share a day, so each block labels its own fields.
let fieldsCount = 0

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
	const sleepId = `sleep-${++fieldsCount}`
	const stepsId = `steps-${fieldsCount}`
	let sleepLogged = false
	let stepsLogged = false
	for (const entry of log) {
		if (entry.kind !== "wellness" || entry.date !== yesterday) continue
		if (entry.sleepHours !== undefined) sleepLogged = true
		if (entry.steps !== undefined) stepsLogged = true
	}
	if (sleepLogged && stepsLogged) return null

	const sleepHours = sleepLogged ? null : sleepHoursInput(sleepId)
	const sleepMinutes = sleepLogged ? null : sleepMinutesInput()
	const steps = stepsLogged ? null : stepsInput(stepsId)

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
			...field(sleep, "Sleep (h / min)", sleepId, "flex-2"),
			...field(steps, "Steps", stepsId, "flex-1"),
		]),
	])

	return {
		element,
		entry: () =>
			wellnessEntryFrom(
				{ hours: sleepHours, minutes: sleepMinutes, steps },
				yesterday,
			),
	}
}
