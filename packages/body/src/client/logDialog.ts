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

const SET_GRID = "grid grid-cols-[1rem_1fr_1fr_1fr_2.25rem] items-center gap-2"

interface SetRow {
	element: HTMLElement
	kg: HTMLInputElement
	reps: HTMLInputElement
	rir: HTMLInputElement
	setPosition: (position: number) => void
	focusRemove: () => void
}

const text = (value?: number) => (value === undefined ? "" : String(value))

function setRow(
	plan: ExercisePlan,
	index: number,
	onRemove: () => void,
): SetRow {
	// The engine filters history by unit, so the last set can seed the extra ones.
	const previous =
		plan.previous?.sets[index] ?? plan.previous?.sets.at(-1) ?? null
	const prefill = plan.target ?? previous

	const number = el("p", { class: `${MUTED} numeric text-xs font-extrabold` })
	const kg = el("input", {
		class: "set-kg",
		type: "number",
		inputmode: "decimal",
		step: "any",
		min: "0",
		value: text(prefill?.kg),
	})
	const reps = el("input", {
		class: "set-reps",
		type: "number",
		inputmode: "numeric",
		step: "1",
		min: "1",
		value: text(prefill?.reps ?? plan.planned.reps?.min),
	})
	// Targets carry no effort, so only the last session can suggest an RIR.
	const rir = el("input", {
		class: "set-rir",
		type: "number",
		inputmode: "numeric",
		step: "1",
		min: "0",
		max: "10",
		value: text(previous?.rir),
	})
	const remove = el(
		"button",
		{
			type: "button",
			class: `set-remove ${MUTED} h-9 w-9 cursor-pointer text-lg leading-none font-black`,
		},
		["\u00d7"],
	)
	remove.addEventListener("click", onRemove)

	const element = el("div", { class: `set-row ${SET_GRID}` }, [
		number,
		kg,
		reps,
		rir,
		remove,
	])

	return {
		element,
		kg,
		reps,
		rir,
		focusRemove: () => remove.focus(),
		setPosition: (position) => {
			number.textContent = String(position)
			kg.setAttribute("aria-label", `Set ${position} load (kg)`)
			reps.setAttribute(
				"aria-label",
				`Set ${position} ${UNIT_LABELS[plan.planned.unit]}`,
			)
			rir.setAttribute("aria-label", `Set ${position} reps in reserve`)
			remove.setAttribute("aria-label", `Remove set ${position}`)
		},
	}
}

function exerciseFields(plan: ExercisePlan): {
	element: HTMLElement
	rows: SetRow[]
} {
	const rows: SetRow[] = []
	const container = el("div", { class: "mt-2 space-y-2" })
	const renumber = () =>
		rows.forEach((row, index) => row.setPosition(index + 1))

	const add = el(
		"button",
		{
			type: "button",
			class: "set-add button-ghost mt-3",
			"aria-label": `Add set to ${plan.exercise.name}`,
		},
		["Add set"],
	)

	const addRow = () => {
		const row: SetRow = setRow(plan, rows.length, () => {
			const index = rows.indexOf(row)
			if (index < 0) return
			rows.splice(index, 1)
			row.element.remove()
			renumber()
			const next = rows[index] ?? rows.at(-1)
			if (next) next.focusRemove()
			else add.focus()
		})
		rows.push(row)
		container.append(row.element)
		renumber()
	}
	add.addEventListener("click", addRow)
	for (let set = 0; set < plan.planned.sets; set++) addRow()

	const element = el("fieldset", { class: "mt-6" }, [
		el("legend", {}, [plan.exercise.name]),
		el("div", { class: SET_GRID, "aria-hidden": "true" }, [
			el("span", {}),
			el("span", { class: CAPTION }, ["kg"]),
			el("span", { class: CAPTION }, [plan.planned.unit]),
			el("span", { class: CAPTION }, ["rir"]),
			el("span", {}),
		]),
		container,
		add,
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
	const cancel = el("button", { type: "button", class: "button-secondary" }, [
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
			el("div", { class: "mt-4 grid grid-cols-2 gap-3" }, [cancel, submit]),
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
			for (const [index, row] of rows.entries()) {
				const blank = [row.kg, row.reps, row.rir].find(
					(input) => input.value === "",
				)
				// A blank field would be lost silently: the exercise locks once logged.
				if (blank) {
					errorNote.textContent = `${plan.exercise.name} — complete the set, or remove it.`
					blank.focus()
					return
				}
				entries.push({
					kind: "strength",
					schemaVersion: LOG_SCHEMA_VERSION,
					id: crypto.randomUUID(),
					date: today,
					session: session.id,
					ref: plan.ref,
					set: index + 1,
					kg: Number(row.kg.value),
					reps: Number(row.reps.value),
					rir: Number(row.rir.value),
					unit: plan.planned.unit,
				})
			}
		}

		if (entries.length === 0) {
			errorNote.textContent = "Nothing to log — every set was removed."
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
