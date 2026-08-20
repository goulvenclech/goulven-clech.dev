import { localDateOf } from "../dates"
import type { DaySession, ExercisePlan } from "../engine"
import { appendEntries } from "../logStore"
import { LOG_SCHEMA_VERSION, type StrengthEntry } from "../schemas"
import { ZodError } from "zod"
import {
	DAY_ROLLED_OVER,
	STORAGE_BLOCKED,
	UNIT_LABELS,
	el,
	type Modal,
} from "./dom"
import { sync } from "./sync"

const MUTED = "text-muted-light dark:text-muted-dark"
const CAPTION = `${MUTED} text-xs font-extrabold tracking-widest uppercase`

/** Set number, the three fields, then the skip toggle. */
const SET_GRID = "grid grid-cols-[1rem_1fr_1fr_1fr_1.75rem] items-center gap-2"

interface SetRow {
	element: HTMLElement
	kg: HTMLInputElement
	reps: HTMLInputElement
	rir: HTMLInputElement
	isSkipped: () => boolean
}

function setRow(plan: ExercisePlan, index: number): SetRow {
	// The engine filters history by unit, so the last set can seed the extra ones.
	const previous =
		plan.previous?.sets[index] ?? plan.previous?.sets.at(-1) ?? null
	const prefill = plan.target ?? previous
	const position = index + 1

	const kg = el("input", {
		class: "set-kg",
		type: "number",
		inputmode: "decimal",
		step: "any",
		min: "0",
		value: prefill === null ? "" : String(prefill.kg),
		"aria-label": `Set ${position} load (kg)`,
	})
	const reps = el("input", {
		class: "set-reps",
		type: "number",
		inputmode: "numeric",
		step: "1",
		min: "1",
		value: prefill === null ? "" : String(prefill.reps),
		"aria-label": `Set ${position} ${UNIT_LABELS[plan.planned.unit]}`,
	})
	// Targets carry no effort, so only the last session can suggest an RIR.
	const rir = el("input", {
		class: "set-rir",
		type: "number",
		inputmode: "numeric",
		step: "1",
		min: "0",
		max: "10",
		value: previous === null ? "" : String(previous.rir),
		"aria-label": `Set ${position} reps in reserve`,
	})

	let skipped = false
	const skip = el(
		"button",
		{
			type: "button",
			class: `set-skip ${MUTED} cursor-pointer text-lg leading-none font-black`,
			"aria-pressed": "false",
			"aria-label": `Skip set ${position}`,
		},
		["×"],
	)

	const element = el("div", { class: `set-row ${SET_GRID}` }, [
		el("p", { class: `${MUTED} numeric text-xs font-extrabold` }, [
			String(position),
		]),
		kg,
		reps,
		rir,
		skip,
	])

	skip.addEventListener("click", () => {
		skipped = !skipped
		for (const input of [kg, reps, rir]) input.disabled = skipped
		element.classList.toggle("opacity-40", skipped)
		skip.setAttribute("aria-pressed", String(skipped))
		skip.setAttribute(
			"aria-label",
			`${skipped ? "Restore" : "Skip"} set ${position}`,
		)
	})

	return { element, kg, reps, rir, isSkipped: () => skipped }
}

function exerciseFields(plan: ExercisePlan): {
	element: HTMLElement
	rows: SetRow[]
} {
	const rows = Array.from({ length: plan.planned.sets }, (_, index) =>
		setRow(plan, index),
	)
	const element = el("fieldset", { class: "mt-6" }, [
		el("legend", {}, [plan.exercise.name]),
		el("div", { class: SET_GRID, "aria-hidden": "true" }, [
			el("span", {}),
			el("span", { class: CAPTION }, ["kg"]),
			el("span", { class: CAPTION }, [plan.planned.unit]),
			el("span", { class: CAPTION }, ["rir"]),
			el("span", {}),
		]),
		el(
			"div",
			{ class: "mt-2 space-y-2" },
			rows.map((row) => row.element),
		),
	])
	return { element, rows }
}

const TITLE_ID = "log-dialog-title"

export function logDialog(
	session: DaySession,
	today: string,
	onSettled: (note?: string) => void,
): Modal | null {
	const pending = session.exercises.filter(
		(plan) => plan.loggedToday.length === 0,
	)
	if (pending.length === 0) return null
	const blocks = pending.map((plan) => ({ plan, ...exerciseFields(plan) }))

	// Always rendered so screen readers announce failures reliably.
	const errorNote = el("p", {
		role: "alert",
		class: "text-primary text-sm font-bold",
	})
	const cancel = el("button", { type: "button", class: "button-ghost" }, [
		"Cancel",
	])
	const submit = el("button", { type: "submit", class: "button-primary" }, [
		"Log session",
	])
	const actions = el(
		"div",
		{
			class:
				"bg-body-light dark:bg-body-dark sticky -bottom-5 -mx-5 -mb-5 mt-6 px-5 pt-4 pb-5",
		},
		[
			errorNote,
			el("div", { class: "mt-4 flex items-center gap-3" }, [
				cancel,
				el("div", { class: "flex-1" }, [submit]),
			]),
		],
	)
	const form = el("form", {}, [
		el("h2", { id: TITLE_ID, class: "mt-0 mb-5 text-lg font-black" }, [
			session.name,
		]),
		...blocks.map((block) => block.element),
		actions,
	])
	const dialog = el("dialog", { "aria-labelledby": TITLE_ID }, [form])

	cancel.addEventListener("click", () => dialog.close())

	form.addEventListener("submit", async (event) => {
		event.preventDefault()
		// Append-only: a write under yesterday's date could never be corrected.
		if (localDateOf(new Date()) !== today) {
			dialog.close()
			onSettled(DAY_ROLLED_OVER)
			return
		}

		const entries: StrengthEntry[] = []
		for (const { plan, rows } of blocks) {
			// Skipped sets leave no gap in the numbering.
			let position = 0
			for (const row of rows) {
				if (row.isSkipped()) continue
				const blank = [row.kg, row.reps, row.rir].find(
					(input) => input.value === "",
				)
				// A blank field would be lost silently: the exercise locks once logged.
				if (blank) {
					errorNote.textContent = `${plan.exercise.name} — complete the set, or skip it.`
					blank.focus()
					return
				}
				position += 1
				entries.push({
					kind: "strength",
					schemaVersion: LOG_SCHEMA_VERSION,
					id: crypto.randomUUID(),
					date: today,
					session: session.id,
					ref: plan.ref,
					set: position,
					kg: Number(row.kg.value),
					reps: Number(row.reps.value),
					rir: Number(row.rir.value),
					unit: plan.planned.unit,
				})
			}
		}

		if (entries.length === 0) {
			errorNote.textContent = "Nothing to log — every set is skipped."
			return
		}

		submit.disabled = true
		try {
			await appendEntries(entries)
			void sync()
			dialog.close()
			onSettled()
		} catch (error) {
			const message =
				error instanceof ZodError
					? "Could not save — check the values (reps ≥ 1, RIR 0–10)."
					: `Could not save — ${STORAGE_BLOCKED}.`
			// Dismissed mid-write: the closed dialog can no longer carry the news.
			if (!dialog.open) onSettled(message)
			else {
				errorNote.textContent = message
				submit.disabled = false
			}
		}
	})

	return {
		element: dialog,
		open: () => {
			errorNote.textContent = ""
			dialog.showModal()
		},
	}
}
