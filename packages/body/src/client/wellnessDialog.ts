import { retractionOf } from "../corrections"
import { formatDayShort } from "../dates"
import { splitHours } from "../duration"
import type { WellnessEntry } from "../schemas"
import { el, type Modal } from "./dom"
import { submitDialog } from "./submitDialog"
import {
	sleepHoursInput,
	sleepMinutesInput,
	stepsInput,
	weightInput,
	wellnessEntryFrom,
	type Metrics,
} from "./wellnessInputs"

// Today's and yesterday's forms share the log page, so each labels its own fields.
let formCount = 0

/** One value per metric; ties break on id, as the stats do. */
function metricsOf(logged: readonly WellnessEntry[]): Metrics {
	const metrics: Metrics = {}
	for (const entry of [...logged].sort((a, b) => a.id.localeCompare(b.id))) {
		if (entry.sleepHours !== undefined) metrics.sleepHours = entry.sleepHours
		if (entry.steps !== undefined) metrics.steps = entry.steps
		if (entry.weightKg !== undefined) metrics.weightKg = entry.weightKg
	}
	return metrics
}

export function wellnessEditDialog(
	date: string,
	logged: readonly WellnessEntry[],
	onSettled: (note?: string) => void,
): Modal {
	const current = metricsOf(logged)
	const [sleptHours, sleptMinutes] =
		current.sleepHours === undefined
			? [undefined, undefined]
			: splitHours(current.sleepHours)
	const suffix = ++formCount
	const sleepId = `wellness-sleep-${suffix}`
	const stepsId = `wellness-steps-${suffix}`
	const weightId = `wellness-weight-${suffix}`
	const hours = sleepHoursInput(sleepId, sleptHours)
	const minutes = sleepMinutesInput(sleptMinutes)
	const steps = stepsInput(stepsId, current.steps)
	const weight = weightInput(weightId, current.weightKg)

	return submitDialog({
		title: `Wellness · ${formatDayShort(date)}`,
		submitLabel: logged.length > 0 ? "Save wellness" : "Log wellness",
		fields: [
			el("div", {}, [
				el("label", { for: sleepId }, ["Sleep (h / min)"]),
				el("div", { class: "flex gap-2" }, [hours, minutes]),
			]),
			el("div", { class: "mt-6 flex gap-3" }, [
				el("div", { class: "flex-1" }, [
					el("label", { for: stepsId }, ["Steps"]),
					steps,
				]),
				el("div", { class: "flex-1" }, [
					el("label", { for: weightId }, ["Weight (kg)"]),
					weight,
				]),
			]),
		],
		wellness: null,
		invalidMessage:
			"Could not save — check the sleep, steps and weight (30–300 kg).",
		onSettled,
		build: (_, live) => {
			const entry = wellnessEntryFrom({ hours, minutes, steps, weight }, date)
			if (!entry)
				return { error: "Nothing to log — fill sleep, steps or weight." }
			if (
				entry.sleepHours === current.sleepHours &&
				entry.steps === current.steps &&
				entry.weightKg === current.weightKg
			)
				return { entries: [] }
			const standing = live.filter(
				(candidate): candidate is WellnessEntry =>
					candidate.kind === "wellness" && candidate.date === date,
			)
			return { entries: [...standing.map(retractionOf), entry] }
		},
	})
}
