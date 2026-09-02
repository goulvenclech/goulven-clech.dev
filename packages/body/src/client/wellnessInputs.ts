import { hoursOf } from "../duration"
import { LOG_SCHEMA_VERSION, type WellnessEntry } from "../schemas"
import { el, inputValue } from "./dom"

export type Metrics = Pick<WellnessEntry, "sleepHours" | "steps" | "weightKg">

const count = (attributes: Record<string, string>) =>
	el("input", {
		type: "number",
		inputmode: "numeric",
		step: "1",
		...attributes,
	})

export const sleepHoursInput = (id: string, value?: number) =>
	count({
		id,
		class: "wellness-sleep",
		min: "0",
		// With the minutes capped at 59, no pair can exceed the stored max.
		max: "23",
		placeholder: "h",
		"aria-label": "Sleep hours",
		value: inputValue(value),
	})

export const sleepMinutesInput = (value?: number) =>
	count({
		class: "wellness-sleep-minutes",
		min: "0",
		max: "59",
		placeholder: "min",
		"aria-label": "Sleep minutes",
		value: inputValue(value),
	})

export const stepsInput = (id: string, value?: number) =>
	count({ id, class: "wellness-steps", min: "1", value: inputValue(value) })

export const weightInput = (id: string, value?: number) =>
	el("input", {
		id,
		class: "wellness-weight",
		type: "number",
		inputmode: "decimal",
		step: "any",
		min: "30",
		max: "300",
		placeholder: "kg",
		value: inputValue(value),
	})

const entered = (input: HTMLInputElement | null | undefined) =>
	input && input.value !== "" ? Number(input.value) : undefined

export interface MetricInputs {
	hours?: HTMLInputElement | null
	minutes?: HTMLInputElement | null
	steps?: HTMLInputElement | null
	weight?: HTMLInputElement | null
}

/** Null when every input is blank; a zero sleep is blank. */
export function wellnessEntryFrom(
	inputs: MetricInputs,
	date: string,
): WellnessEntry | null {
	const slept = hoursOf(
		entered(inputs.hours) ?? 0,
		entered(inputs.minutes) ?? 0,
	)
	const steps = entered(inputs.steps)
	const weightKg = entered(inputs.weight)
	if (slept === 0 && steps === undefined && weightKg === undefined) return null
	return {
		kind: "wellness",
		schemaVersion: LOG_SCHEMA_VERSION,
		id: crypto.randomUUID(),
		date,
		...(slept === 0 ? {} : { sleepHours: slept }),
		...(steps === undefined ? {} : { steps }),
		...(weightKg === undefined ? {} : { weightKg }),
	}
}
