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
	type PlanDay,
} from "../schemas"
import { ZodError } from "zod"
import {
	DAY_ROLLED_OVER,
	STORAGE_BLOCKED,
	UNIT_LABELS,
	el,
	formatSet,
	type Modal,
	setPageHeader,
	storageErrorNote,
} from "./dom"
import { logDialog } from "./logDialog"
import { loginDialog } from "./loginDialog"
import { sync, syncToken } from "./sync"

const MUTED = "text-muted-light dark:text-muted-dark"

const BASIS_LABELS: Record<TargetBasis, string> = {
	progress: "Load up — every set hit the top last time",
	hold: "Same load — one more rep",
	"stall-deload": "Deload — three identical sessions",
	"layoff-deload": "Deload — more than two weeks off",
}

function headerFor(day: PlanDay): { title: string; place: string } {
	if (day.kind === "rest") return { title: "Rest", place: "day off" }
	if (day.kind === "conditioning") return { title: day.title, place: "at home" }
	return { title: SESSIONS[day.session].name, place: "at the gym" }
}

export async function renderToday(
	root: HTMLElement,
	note?: string,
): Promise<void> {
	const today = localDateOf(new Date())
	const day = planFor(today)
	const header = headerFor(day)
	setPageHeader(header.title, `${formatDay(today)}, ${header.place}`)

	let log: LogEntry[]
	try {
		log = await readLog()
	} catch {
		root.replaceChildren(storageErrorNote())
		return
	}
	const rerender = (nextNote?: string) => renderToday(root, nextNote)

	let children: Node[]
	if (day.kind === "rest")
		children = [
			el("section", { class: "panel mt-8" }, [
				el("p", { class: "text-sm font-bold" }, [
					"Nothing to log today — see you tomorrow.",
				]),
			]),
		]
	else if (day.kind === "conditioning")
		children = [conditioningSection(day.title, log, today, rerender)]
	else {
		const session = todaysSession(SESSIONS[day.session], EXERCISES, log, today)
		children = session.exercises.map(exercisePanel)
		const form = logDialog(session, today, rerender)
		if (form) children.push(...logControls(form, today, rerender))
	}

	if (note)
		children.unshift(
			el("p", { role: "alert", class: "text-primary mt-8 text-sm font-bold" }, [
				note,
			]),
		)
	root.replaceChildren(...children)
	// Fire and forget: pulled entries surface on the next navigation — a
	// re-render here would wipe an open log dialog.
	void sync()
}

function logControls(
	form: Modal,
	today: string,
	rerender: (note?: string) => void,
): Node[] {
	// Sync is optional: dismissing the offer still opens the log form.
	const login = loginDialog(() => form.open())

	const open = el("button", { class: "button-primary mt-8" }, ["Log session"])
	open.addEventListener("click", () => {
		// A tab left open overnight would otherwise log yesterday's plan.
		if (localDateOf(new Date()) !== today)
			rerender("The day changed — this is today's session.")
		else if (syncToken()) form.open()
		else login.open()
	})
	return [open, login.element, form.element]
}

const doneLine = (sets: readonly PerformedSet[]) =>
	el("p", { class: "numeric mt-3 text-sm font-semibold" }, [
		el("span", { class: "font-extrabold" }, ["Done"]),
		el("span", { class: MUTED }, [` ${sets.map(formatSet).join(" · ")}`]),
	])

function exercisePanel(plan: ExercisePlan): HTMLElement {
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

	if (plan.loggedToday.length > 0) section.append(doneLine(plan.loggedToday))
	return section
}

function conditioningSection(
	title: string,
	log: readonly LogEntry[],
	today: string,
	onSettled: (note?: string) => void,
): HTMLElement {
	const logged = log.find(
		(entry): entry is ConditioningEntry =>
			entry.kind === "conditioning" && entry.date === today,
	)
	if (logged)
		return el("section", { class: "panel mt-8" }, [
			el("p", { class: "text-lg font-black" }, ["Done"]),
			el("p", { class: "numeric mt-2 text-sm font-semibold" }, [
				el("span", { class: "font-extrabold" }, [logged.workout]),
				el("span", { class: MUTED }, [
					` level ${logged.level} · ${logged.sets} sets`,
				]),
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
			onSettled(DAY_ROLLED_OVER)
			return
		}
		const data = new FormData(form)
		const entry: ConditioningEntry = {
			kind: "conditioning",
			schemaVersion: LOG_SCHEMA_VERSION,
			id: crypto.randomUUID(),
			date: today,
			category: title,
			workout: String(data.get("workout") ?? "").trim(),
			level: Number(data.get("level")),
			sets: Number(data.get("sets")),
		}
		const button = form.querySelector<HTMLButtonElement>("button")!
		button.disabled = true
		try {
			await appendEntries([entry])
			void sync()
			onSettled()
		} catch (error) {
			form.querySelector<HTMLParagraphElement>("[role=alert]")!.textContent =
				error instanceof ZodError
					? "Could not save — check the workout, level (1–5) and sets."
					: `Could not save — ${STORAGE_BLOCKED}.`
			button.disabled = false
		}
	})
	return form
}
