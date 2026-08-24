import { formatDay, localDateOf } from "../dates"
import {
	formatSet,
	guidanceFor,
	plannedSummary,
	skippedOf,
	skippedSummary,
	targetSummary,
} from "../dayLog"
import { todaysSession, type ExercisePlan } from "../engine"
import { appendEntries, readLog } from "../logStore"
import { markMissedDays } from "../missedDays"
import { EXERCISES, SESSIONS, planFor, planTitle } from "../program"
import {
	type ConditioningEntry,
	type LogEntry,
	type PlanDay,
	type SkippedEntry,
} from "../schemas"
import { ZodError } from "zod"
import {
	DAY_ROLLED_OVER,
	STORAGE_BLOCKED,
	el,
	type Modal,
	setPageHeader,
	storageErrorNote,
} from "./dom"
import { conditioningDialog } from "./conditioningDialog"
import { logDialog } from "./logDialog"
import { loginDialog } from "./loginDialog"
import { skipDialog } from "./skipDialog"
import { sync, syncToken } from "./sync"
import { wellnessFields, type WellnessFields } from "./wellnessFields"

const MUTED = "text-muted-light dark:text-muted-dark"

function headerFor(day: PlanDay): { title: string; place: string } {
	const place =
		day.kind === "rest"
			? "day off"
			: day.kind === "conditioning"
				? "at home"
				: "at the gym"
	return { title: planTitle(day), place }
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

	const skipped =
		skippedOf(log.filter((entry) => entry.date === today))[0] ?? null
	const skip = () => ({
		label: "Skip session",
		form: skipDialog(planTitle(day), today, log, rerender),
	})

	let children: Node[]
	if (day.kind === "rest") {
		children = [
			el("section", { class: "panel mt-8" }, [
				el("p", { class: "text-sm font-bold" }, [
					"Nothing to log today — see you tomorrow.",
				]),
			]),
			...inlineWellness(log, today, rerender),
		]
	} else if (skipped) {
		children = [skippedPanel(skipped), ...inlineWellness(log, today, rerender)]
	} else if (day.kind === "conditioning") {
		const logged =
			log.find(
				(entry): entry is ConditioningEntry =>
					entry.kind === "conditioning" && entry.date === today,
			) ?? null
		children = [conditioningPanel(day.title, logged)]
		if (!logged) {
			const form = conditioningDialog(day.title, today, log, rerender)
			children.push(
				...logControls(
					[{ label: "Log workout", form }, skip()],
					today,
					rerender,
				),
			)
		}
	} else {
		const session = todaysSession(SESSIONS[day.session], EXERCISES, log, today)
		children = [
			el(
				"div",
				{ class: "mt-8 space-y-3" },
				session.exercises.map(exercisePanel),
			),
		]
		const form = logDialog(session, today, log, rerender)
		const untouched = session.exercises.every(
			(plan) => plan.loggedToday.length === 0,
		)
		if (form)
			children.push(
				...logControls(
					[{ label: "Log session", form }, ...(untouched ? [skip()] : [])],
					today,
					rerender,
				),
			)
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
		.then((result) => {
			// A partial pull is full of holes that are not misses, and a visitor's
			// writes would sit in an outbox that can never drain.
			if (result.offline || !syncToken()) return
			return markMissedDays(today)
		})
		.catch(() => {})
}

function logControls(
	actions: readonly { label: string; form: Modal }[],
	today: string,
	rerender: (note?: string) => void,
): Node[] {
	// Rerender rather than open: the forms were built from the pre-pull log,
	// and the login's own sync may have just filled it.
	const login = loginDialog((authenticated) => {
		if (authenticated) rerender()
	})

	const buttons = actions.map(({ label, form }, index) => {
		const open = el(
			"button",
			{ class: index === 0 ? "button-primary" : "button-secondary" },
			[label],
		)
		open.addEventListener("click", () => {
			// A tab left open overnight would otherwise log yesterday's plan.
			if (localDateOf(new Date()) !== today)
				rerender("The day changed — this is today's session.")
			else if (syncToken()) form.open()
			else login.open()
		})
		return open
	})

	return [
		el("div", { class: "mt-8 space-y-3" }, buttons),
		login.element,
		...actions.map(({ form }) => form.element),
	]
}

/** Without this, yesterday's sleep and steps could never be logged at all. */
function inlineWellness(
	log: readonly LogEntry[],
	today: string,
	rerender: (note?: string) => void,
): Node[] {
	const wellness = wellnessFields(log, today)
	if (!wellness) return []
	return syncToken()
		? [wellnessForm(wellness, today, rerender)]
		: wellnessSyncGate(rerender)
}

/** The inline form has no dialog, so its gate swaps the fields for a login. */
function wellnessSyncGate(rerender: (note?: string) => void): Node[] {
	const login = loginDialog((authenticated) => {
		if (authenticated) rerender()
	})
	const open = el("button", { class: "button-primary mt-6" }, ["Log yesterday"])
	open.addEventListener("click", login.open)
	return [open, login.element]
}

const doneLine = (suffix: string) =>
	el("p", { class: "numeric mt-3 text-sm font-semibold" }, [
		el("span", { class: "font-extrabold" }, ["Done"]),
		el("span", { class: MUTED }, [` ${suffix}`]),
	])

function skippedPanel(entry: SkippedEntry): HTMLElement {
	return el("section", { class: "panel mt-8" }, [
		el("p", { class: "text-sm font-extrabold" }, [`${entry.planned} skipped`]),
		el("p", { class: `${MUTED} mt-1 text-xs font-semibold` }, [
			skippedSummary(entry),
		]),
	])
}

function exercisePanel(plan: ExercisePlan): HTMLElement {
	const section = el("section", { class: "panel" }, [
		el("div", { class: "flex items-baseline justify-between gap-3" }, [
			el("p", { class: "text-sm font-extrabold" }, [plan.exercise.name]),
			el("p", { class: "numeric text-sm font-black" }, [targetSummary(plan)]),
		]),
		el("p", { class: `${MUTED} mt-1 text-xs font-semibold` }, [
			`${plannedSummary(plan.planned)} · ${guidanceFor(plan)}`,
		]),
	])

	if (plan.loggedToday.length > 0)
		section.append(doneLine(plan.loggedToday.map(formatSet).join(" · ")))
	return section
}

function wellnessForm(
	wellness: WellnessFields,
	today: string,
	onSettled: (note?: string) => void,
): HTMLElement {
	const form = el("form", {}, [
		wellness.element,
		el("p", { role: "alert", class: "text-primary mt-4 text-sm font-bold" }),
		el("button", { class: "button-primary mt-6" }, ["Log yesterday"]),
	])

	form.addEventListener("submit", async (event) => {
		event.preventDefault()
		// Append-only: a write under yesterday's date could never be corrected.
		if (localDateOf(new Date()) !== today) {
			onSettled(DAY_ROLLED_OVER)
			return
		}
		const alert = form.querySelector<HTMLParagraphElement>("[role=alert]")!
		const entry = wellness.entry()
		if (!entry) {
			alert.textContent = "Nothing to log — fill sleep or steps."
			return
		}
		const button = form.querySelector<HTMLButtonElement>("button")!
		button.disabled = true
		try {
			await appendEntries([entry])
			void sync()
			onSettled()
		} catch (error) {
			alert.textContent =
				error instanceof ZodError
					? "Could not save — check the sleep hours and steps."
					: `Could not save — ${STORAGE_BLOCKED}.`
			button.disabled = false
		}
	})
	return form
}

const DAREBEE = "https://darebee.com/workout.html"

const DAREBEE_FILTERS: Record<string, { label: string; url: string }[]> = {
	Cardio: [
		{ label: "Cardio", url: `${DAREBEE}#ty=cardio` },
		{ label: "HIIT", url: `${DAREBEE}#ty=hiit` },
	],
	Combat: [{ label: "Combat", url: `${DAREBEE}#ty=combat` }],
}

// Titles are free text in the plan, so an unmapped one falls back to a search.
const darebeeLinks = (title: string) =>
	DAREBEE_FILTERS[title] ?? [
		{
			label: title,
			url: `${DAREBEE}#q=${encodeURIComponent(title.toLowerCase())}`,
		},
	]

function conditioningPanel(
	title: string,
	logged: ConditioningEntry | null,
): HTMLElement {
	const links = darebeeLinks(title).map(({ label, url }) =>
		el(
			"a",
			{
				class: "link text-sm font-bold",
				href: url,
				target: "_blank",
				rel: "noreferrer",
			},
			[
				label,
				el("span", { "aria-hidden": "true" }, [" ↗"]),
				el("span", { class: "sr-only" }, [" (opens in a new tab)"]),
			],
		),
	)
	const section = el("section", { class: "panel mt-8" }, [
		el("p", { class: "text-sm font-extrabold" }, ["Darebee"]),
		el("p", { class: `${MUTED} mt-1 text-xs font-semibold` }, [
			"Pick today's workout.",
		]),
		el("div", { class: "mt-3 flex flex-wrap gap-4" }, links),
	])
	if (logged)
		section.append(
			doneLine(
				`${logged.workout} · level ${logged.level} · ${logged.sets} sets`,
			),
		)
	return section
}
