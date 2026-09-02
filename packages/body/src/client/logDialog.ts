import { retractionOf } from "../corrections"
import { formatDayShort } from "../dates"
import { UNIT_LABELS } from "../dayLog"
import type { DaySession, ExercisePlan } from "../engine"
import {
	LOG_SCHEMA_VERSION,
	type LogEntry,
	type StrengthEntry,
} from "../schemas"
import { exerciseByRef } from "../program"
import { el, inputValue, type Modal } from "./dom"
import { submitDialog } from "./submitDialog"
import { weightField, type WeightField } from "./weightField"
import { wellnessFields, type WellnessFields } from "./wellnessFields"

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

interface Seed {
	kg?: number
	reps?: number
	rir?: number
}

function seedFor(
	plan: ExercisePlan,
	logged: readonly StrengthEntry[],
	index: number,
): Seed {
	const written = logged[index] ?? logged.at(-1)
	if (written) return written
	// The engine filters history by unit, so the last set can seed the extra ones.
	const previous =
		plan.previous?.sets[index] ?? plan.previous?.sets.at(-1) ?? null
	const prefill = plan.target ?? previous
	// Targets carry no effort, so only the last session can suggest an RIR.
	return {
		kg: prefill?.kg,
		reps: prefill?.reps ?? plan.planned.reps?.min,
		rir: previous?.rir,
	}
}

function setRow(plan: ExercisePlan, seed: Seed, onRemove: () => void): SetRow {
	const number = el("p", { class: `${MUTED} numeric text-xs font-extrabold` })
	const kg = el("input", {
		class: "set-kg",
		type: "number",
		inputmode: "decimal",
		step: "any",
		min: "0",
		value: inputValue(seed.kg),
	})
	const reps = el("input", {
		class: "set-reps",
		type: "number",
		inputmode: "numeric",
		step: "1",
		min: "1",
		value: inputValue(seed.reps),
	})
	const rir = el("input", {
		class: "set-rir",
		type: "number",
		inputmode: "numeric",
		step: "1",
		min: "0",
		max: "10",
		value: inputValue(seed.rir),
	})
	const remove = el(
		"button",
		{
			type: "button",
			class: `set-remove ${MUTED} h-9 w-9 cursor-pointer text-lg leading-none font-black`,
		},
		["×"],
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

function exerciseFields(
	plan: ExercisePlan,
	logged: readonly StrengthEntry[],
	initialRows: number,
): {
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
		const row: SetRow = setRow(plan, seedFor(plan, logged, rows.length), () => {
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
	for (let set = 0; set < initialRows; set++) addRow()

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

interface ExerciseBlock {
	plan: ExercisePlan
	logged: StrengthEntry[]
	initialRows: number
}

const loggedSets = (log: readonly LogEntry[], date: string, ref: string) =>
	log
		.filter(
			(entry): entry is StrengthEntry =>
				entry.kind === "strength" && entry.date === date && entry.ref === ref,
		)
		.sort((a, b) => a.set - b.set)

const sameSets = (
	logged: readonly StrengthEntry[],
	sets: readonly StrengthEntry[],
) =>
	logged.length === sets.length &&
	sets.every(
		(set, index) =>
			set.kg === logged[index].kg &&
			set.reps === logged[index].reps &&
			set.rir === logged[index].rir,
	)

function sessionDialog(options: {
	title: string
	submitLabel: string
	session: DaySession
	date: string
	blocks: readonly ExerciseBlock[]
	weight: WeightField | null
	wellness: WellnessFields | null
	onSettled: (note?: string) => void
}): Modal {
	const { session, date, weight } = options
	const blocks = options.blocks.map((block) => ({
		...block,
		...exerciseFields(block.plan, block.logged, block.initialRows),
	}))

	return submitDialog({
		title: options.title,
		submitLabel: options.submitLabel,
		fields: [
			...(weight ? [weight.element] : []),
			...blocks.map((block) => block.element),
		],
		wellness: options.wellness,
		invalidMessage: "Could not save — check the values (reps ≥ 1, RIR 0–10).",
		onSettled: options.onSettled,
		build: (wellnessEntry, live) => {
			const entries: LogEntry[] = []
			let kept = 0
			for (const { plan, logged, rows } of blocks) {
				kept += rows.length
				const sets: StrengthEntry[] = []
				for (const [index, row] of rows.entries()) {
					const blank = [row.kg, row.reps].find((input) => input.value === "")
					// A blank load or count would otherwise vanish from the day silently.
					if (blank)
						return {
							error: `${plan.exercise.name} — complete the set, or remove it.`,
							focus: blank,
						}
					const rir = row.rir.value
					sets.push({
						kind: "strength",
						schemaVersion: LOG_SCHEMA_VERSION,
						id: crypto.randomUUID(),
						date,
						session: session.id,
						ref: plan.ref,
						set: index + 1,
						kg: Number(row.kg.value),
						reps: Number(row.reps.value),
						...(rir === "" ? {} : { rir: Number(rir) }),
						unit: plan.planned.unit,
					})
				}
				// Compared with what the form opened with; withdrawn as the log stands now.
				if (sameSets(logged, sets)) continue
				if (logged.length > 0)
					entries.push(...loggedSets(live, date, plan.ref).map(retractionOf))
				entries.push(...sets)
			}

			const extras: LogEntry[] = []
			const weightEntry = weight?.entry()
			if (weightEntry) extras.push(weightEntry)
			if (wellnessEntry) extras.push(wellnessEntry)
			// Retractions alone are not something to log.
			if (kept === 0 && extras.length === 0)
				return { error: "Nothing to log — every set was removed." }
			return { entries: [...entries, ...extras] }
		},
	})
}

export function logDialog(
	session: DaySession,
	today: string,
	log: readonly LogEntry[],
	onSettled: (note?: string) => void,
): Modal | null {
	const pending = session.exercises.filter(
		(plan) => plan.loggedToday.length === 0,
	)
	if (pending.length === 0) return null
	return sessionDialog({
		title: "Strength",
		submitLabel: "Log session",
		session,
		date: today,
		blocks: pending.map((plan) => ({
			plan,
			logged: [],
			initialRows: plan.planned.sets,
		})),
		weight: weightField(log, today),
		wellness: wellnessFields(log, today),
		onSettled,
	})
}

export function sessionEditDialog(
	session: DaySession,
	date: string,
	log: readonly LogEntry[],
	onSettled: (note?: string) => void,
): Modal {
	const listed = session.exercises.map((plan) => ({
		plan,
		logged: loggedSets(log, date, plan.ref),
	}))
	const strayRefs = new Set(
		log.flatMap((entry) =>
			entry.kind === "strength" &&
			entry.date === date &&
			!session.exercises.some((plan) => plan.ref === entry.ref)
				? [entry.ref]
				: [],
		),
	)
	const strays = [...strayRefs].sort().flatMap((ref) => {
		const exercise = exerciseByRef(ref)
		if (!exercise) return []
		const logged = loggedSets(log, date, ref)
		const plan: ExercisePlan = {
			ref,
			exercise,
			planned: {
				ref,
				sets: logged.length,
				progression: "manual",
				unit: logged[0].unit ?? "reps",
			},
			target: null,
			previous: null,
			loggedToday: [],
		}
		return [{ plan, logged }]
	})
	const blocks = [...listed, ...strays]
	const correcting = blocks.some(({ logged }) => logged.length > 0)
	return sessionDialog({
		title: `Strength · ${formatDayShort(date)}`,
		submitLabel: correcting ? "Save session" : "Log session",
		session,
		date,
		blocks: blocks.map(({ plan, logged }) => ({
			plan,
			logged,
			initialRows: correcting ? logged.length : plan.planned.sets,
		})),
		weight: null,
		wellness: null,
		onSettled,
	})
}
