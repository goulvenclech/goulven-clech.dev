import { formatDay, formatDayShort, localDateOf } from "../dates"
import {
	todaysSession,
	type ExercisePlan,
	type PerformedSet,
	type TargetBasis,
} from "../engine"
import { appendEntries, readLog } from "../logStore"
import { EXERCISES, SESSIONS, planFor } from "../program"
import {
	LOG_SCHEMA_VERSION,
	type ConditioningEntry,
	type LogEntry,
	type StrengthEntry,
} from "../schemas"
import { ZodError } from "zod"
import { STORAGE_BLOCKED, el, formatSet, storageErrorNote } from "./dom"
import { sync } from "./sync"

const MUTED = "text-muted-light dark:text-muted-dark"

const BASIS_LABELS: Record<TargetBasis, string> = {
	progress: "Load up — every set hit the top last time",
	hold: "Same load — one more rep",
	"stall-deload": "Deload — three identical sessions",
	"layoff-deload": "Deload — more than two weeks off",
}

export async function renderToday(root: HTMLElement): Promise<void> {
	const today = localDateOf(new Date())
	const day = planFor(today)
	let log: LogEntry[]
	try {
		log = await readLog()
	} catch {
		root.replaceChildren(storageErrorNote())
		return
	}
	const rerender = () => renderToday(root)

	const children: Node[] = [
		el(
			"p",
			{ class: `${MUTED} text-xs font-extrabold tracking-widest uppercase` },
			[formatDay(today)],
		),
	]

	if (day.kind === "rest")
		children.push(
			el("h1", { class: "mt-2" }, ["Rest"]),
			el("section", { class: "panel mt-8" }, [
				el("p", { class: "text-sm font-bold" }, [
					"Nothing to log today — see you tomorrow.",
				]),
			]),
		)
	else if (day.kind === "conditioning")
		children.push(
			el("h1", { class: "mt-2" }, [day.title]),
			el("p", { class: `${MUTED} mt-2 text-sm font-bold` }, ["At home"]),
			conditioningSection(day.title, log, today, rerender),
		)
	else {
		const session = todaysSession(SESSIONS[day.session], EXERCISES, log, today)
		children.push(
			el("h1", { class: "mt-2" }, [session.name]),
			el("p", { class: `${MUTED} mt-2 text-sm font-bold` }, ["At the gym"]),
			...session.exercises.map((plan) =>
				exerciseSection(plan, session.id, today, rerender),
			),
		)
	}

	root.replaceChildren(...children)
	// Fire and forget: pulled entries surface on the next navigation — a
	// re-render here would wipe in-progress inputs.
	void sync()
}

const UNIT_LABELS = { reps: "reps", m: "metres", s: "seconds" } as const

const doneLine = (sets: readonly PerformedSet[]) =>
	el("p", { class: "numeric mt-3 text-sm font-semibold" }, [
		el("span", { class: "font-extrabold" }, ["Done"]),
		el("span", { class: MUTED }, [` ${sets.map(formatSet).join(" · ")}`]),
	])

function exerciseSection(
	plan: ExercisePlan,
	sessionId: string,
	today: string,
	rerender: () => void,
): HTMLElement {
	const { planned, exercise, target, previous } = plan
	const assist = exercise.direction === "descending" ? " assist" : ""

	const setsInfo = planned.reps
		? `${planned.sets} sets of ${planned.reps.min}–${planned.reps.max}`
		: `${planned.sets} sets (${UNIT_LABELS[planned.unit]})`
	const guidance =
		planned.progression === "manual"
			? previous
				? `Manual — prefilled from ${formatDayShort(previous.date)}`
				: "Manual — log what you did"
			: target
				? BASIS_LABELS[target.basis]
				: "First time — pick a starting load"

	const section = el("section", { class: "panel mt-8" }, [
		el("div", { class: "flex items-baseline justify-between gap-3" }, [
			el("p", { class: "text-sm font-extrabold" }, [exercise.name]),
			el("p", { class: "numeric text-sm font-black" }, [
				target ? `${target.kg} kg${assist} × ${target.reps}` : "—",
			]),
		]),
		el("p", { class: `${MUTED} mt-1 text-xs font-semibold` }, [
			`${setsInfo} · ${guidance}`,
		]),
	])

	if (plan.loggedToday.length > 0) {
		section.append(doneLine(plan.loggedToday))
		return section
	}

	const rows = Array.from({ length: planned.sets }, (_, index) => {
		const prefill = target ?? previous?.sets[index] ?? null
		return el("div", { class: "set-row flex items-center gap-2" }, [
			el("p", { class: `${MUTED} numeric w-4 text-xs font-extrabold` }, [
				String(index + 1),
			]),
			el("input", {
				class: "set-kg w-24!",
				type: "number",
				inputmode: "decimal",
				step: "any",
				min: "0",
				placeholder: "kg",
				value: prefill === null ? "" : String(prefill.kg),
				"aria-label": `Set ${index + 1} load (kg)`,
			}),
			el("input", {
				class: "set-reps w-20!",
				type: "number",
				inputmode: "numeric",
				step: "1",
				min: "1",
				placeholder: planned.unit,
				value: prefill === null ? "" : String(prefill.reps),
				"aria-label": `Set ${index + 1} ${UNIT_LABELS[planned.unit]}`,
			}),
			el("input", {
				class: "set-rir w-16!",
				type: "number",
				inputmode: "numeric",
				step: "1",
				min: "0",
				max: "10",
				placeholder: "RIR",
				"aria-label": `Set ${index + 1} reps in reserve`,
			}),
		])
	})

	// Always rendered so screen readers announce failures reliably.
	const errorNote = el("p", {
		role: "alert",
		class: "text-primary mt-3 text-sm font-bold",
	})
	const logButton = el("button", { class: "button-ghost mt-4" }, ["Log sets"])

	logButton.addEventListener("click", async () => {
		// Append-only: a write under yesterday's date could never be corrected.
		if (localDateOf(new Date()) !== today) {
			rerender()
			return
		}
		const values = rows.map((row) => ({
			kg: row.querySelector<HTMLInputElement>(".set-kg")!.value,
			reps: row.querySelector<HTMLInputElement>(".set-reps")!.value,
			rir: row.querySelector<HTMLInputElement>(".set-rir")!.value,
		}))
		// Untouched rows are skipped sets; a half-filled row must block, since
		// logging the rest would silently lose it (the exercise locks once logged).
		const touched = values.filter(
			(row) => row.kg !== "" || row.reps !== "" || row.rir !== "",
		)
		if (
			touched.some((row) => row.kg === "" || row.reps === "" || row.rir === "")
		) {
			errorNote.textContent =
				"A set is half-filled — complete kg, reps and RIR, or clear it."
			return
		}
		if (touched.length === 0) {
			errorNote.textContent = "Nothing to log — fill in at least one set."
			return
		}

		const entries: StrengthEntry[] = touched.map((row, index) => ({
			kind: "strength",
			schemaVersion: LOG_SCHEMA_VERSION,
			id: crypto.randomUUID(),
			date: today,
			session: sessionId,
			ref: plan.ref,
			set: index + 1,
			kg: Number(row.kg),
			reps: Number(row.reps),
			rir: Number(row.rir),
			unit: planned.unit,
		}))

		logButton.disabled = true
		try {
			await appendEntries(entries)
			void sync()
			// Swap only this section: a full re-render would wipe in-progress
			// inputs in the other sections.
			setsContainer.remove()
			errorNote.remove()
			logButton.remove()
			section.append(
				doneLine(
					entries.map(({ kg, reps, rir, unit }) => ({ kg, reps, rir, unit })),
				),
			)
		} catch (error) {
			errorNote.textContent =
				error instanceof ZodError
					? "Could not save — check the values (reps ≥ 1, RIR 0–10)."
					: `Could not save — ${STORAGE_BLOCKED}.`
			logButton.disabled = false
		}
	})

	const setsContainer = el("div", { class: "mt-4 space-y-2" }, rows)
	section.append(setsContainer, errorNote, logButton)
	return section
}

function conditioningSection(
	title: string,
	log: readonly LogEntry[],
	today: string,
	onLogged: () => void,
): HTMLElement {
	const logged = log.find(
		(entry): entry is ConditioningEntry =>
			entry.kind === "conditioning" && entry.date === today,
	)
	if (logged)
		return el("section", { class: "panel mt-8" }, [
			el("p", { class: "text-lg font-black" }, ["Done"]),
			el("p", { class: `numeric ${MUTED} mt-2 text-sm font-semibold` }, [
				`${logged.workout} — level ${logged.level} · ${logged.sets} sets`,
			]),
		])

	const form = el("form", { class: "mt-8" }, [
		el("div", {}, [
			el("label", { for: "workout" }, ["Workout"]),
			el("input", {
				id: "workout",
				name: "workout",
				type: "text",
				value: title.toLowerCase(),
				required: "",
			}),
		]),
		el("div", { class: "mt-6 flex gap-3" }, [
			el("div", { class: "flex-1" }, [
				el("label", { for: "level" }, ["Level"]),
				el("input", {
					id: "level",
					name: "level",
					type: "number",
					inputmode: "numeric",
					step: "1",
					min: "1",
					max: "5",
					required: "",
				}),
			]),
			el("div", { class: "flex-1" }, [
				el("label", { for: "sets" }, ["Sets"]),
				el("input", {
					id: "sets",
					name: "sets",
					type: "number",
					inputmode: "numeric",
					step: "1",
					min: "1",
					required: "",
				}),
			]),
		]),
		el("p", { role: "alert", class: "text-primary mt-4 text-sm font-bold" }),
		el("button", { class: "button-primary mt-6" }, ["Log workout"]),
	])

	form.addEventListener("submit", async (event) => {
		event.preventDefault()
		// Append-only: a write under yesterday's date could never be corrected.
		if (localDateOf(new Date()) !== today) {
			onLogged()
			return
		}
		const data = new FormData(form)
		const entry: ConditioningEntry = {
			kind: "conditioning",
			schemaVersion: LOG_SCHEMA_VERSION,
			id: crypto.randomUUID(),
			date: today,
			workout: String(data.get("workout") ?? "").trim(),
			level: Number(data.get("level")),
			sets: Number(data.get("sets")),
		}
		const button = form.querySelector<HTMLButtonElement>("button")!
		button.disabled = true
		try {
			await appendEntries([entry])
			void sync()
			onLogged()
		} catch (error) {
			form.querySelector<HTMLParagraphElement>("[role=alert]")!.textContent =
				error instanceof ZodError
					? "Could not save — check the values (level 1–5, sets ≥ 1)."
					: `Could not save — ${STORAGE_BLOCKED}.`
			button.disabled = false
		}
	})
	return form
}
