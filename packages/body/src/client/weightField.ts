import type { LogEntry, WellnessEntry } from "../schemas"
import { el } from "./dom"
import { weightInput, wellnessEntryFrom } from "./wellnessInputs"

// The dialog can be rebuilt after a partial log, so each block labels its own.
let fieldsCount = 0

export interface WeightField {
	element: HTMLElement
	entry: () => WellnessEntry | null
}

/** The log is append-only, so the field goes once today's reading is in. */
export function weightField(
	log: readonly LogEntry[],
	today: string,
): WeightField | null {
	const logged = log.some(
		(entry) =>
			entry.kind === "wellness" &&
			entry.date === today &&
			entry.weightKg !== undefined,
	)
	if (logged) return null

	const id = `weight-${++fieldsCount}`
	const input = weightInput(id)

	const element = el("fieldset", { class: "wellness mt-6" }, [
		el("legend", {}, ["Weigh-in"]),
		el("div", { class: "flex gap-3" }, [
			el("div", { class: "flex-1" }, [
				el("label", { for: id }, ["Weight (kg)"]),
				input,
			]),
		]),
	])

	return { element, entry: () => wellnessEntryFrom({ weight: input }, today) }
}
