import { addDays, formatDayShort, localDateOf } from "../dates"
import {
	conditioningSummary,
	formatSet,
	groupByDay,
	skippedSummary,
	wellnessSummary,
	type DayLog,
} from "../dayLog"
import { todaysSession } from "../engine"
import { readLog } from "../logStore"
import { EXERCISES, SESSIONS, planFor } from "../program"
import type { ConditioningEntry, LogEntry, SessionTemplate } from "../schemas"
import { conditioningEditDialog } from "./conditioningDialog"
import { el, storageErrorNote, type Modal } from "./dom"
import { sessionEditDialog } from "./logDialog"
import { sync, syncToken, takeAbandoned } from "./sync"
import { wellnessEditDialog } from "./wellnessDialog"

const MUTED = "text-muted-light dark:text-muted-dark"
const LABEL =
	"min-w-0 truncate text-xs font-extrabold tracking-widest uppercase"

function syncNote(abandoned: number, rejected: boolean): string | undefined {
	if (abandoned > 0)
		return `${abandoned} ${abandoned === 1 ? "entry" : "entries"} could not be synced and will stay on this device.`
	if (rejected) return "Sync is failing — it will try again on the next visit."
	return undefined
}

export async function renderLog(
	root: HTMLElement,
	autoSync = true,
	note?: string,
): Promise<void> {
	let log: LogEntry[]
	try {
		log = await readLog()
	} catch {
		root.replaceChildren(storageErrorNote())
		return
	}
	const rerender = (nextNote?: string) => renderLog(root, false, nextNote)

	const errorNote = el(
		"p",
		{ role: "alert", class: "text-primary mt-8 text-sm font-bold" },
		note ? [note] : [],
	)
	// A 401 wipes the token mid-sync, so afterwards a lost password looks like
	// a device that never had one — and only the former is worth saying.
	const hadToken = Boolean(syncToken())

	if (autoSync)
		void sync().then((result) => {
			const failure = syncNote(takeAbandoned(), result.rejected)
			const nextNote =
				result.authRequired && hadToken
					? (failure ?? "Sync password needed again.")
					: failure
			// A re-render would drop an open correction dialog, and what was typed in it.
			const landed = result.pulled > 0 || result.pushed > 0
			if (landed && !root.querySelector("dialog[open]")) rerender(nextNote)
			else if (nextNote) errorNote.textContent = nextNote
		})

	if (log.length === 0) {
		root.replaceChildren(
			errorNote,
			el("p", { class: `${MUTED} mt-4 text-sm font-bold` }, [
				"Nothing logged yet.",
			]),
		)
		return
	}

	const today = localDateOf(new Date())
	const correctable = hadToken ? [today, addDays(today, -1)] : []

	root.replaceChildren(
		errorNote,
		el(
			"ul",
			{ class: "mt-4 space-y-3" },
			groupByDay(log).map((day) =>
				dayPanel(
					day,
					correctable.includes(day.date)
						? dayCorrection(day, log, today, rerender)
						: [],
				),
			),
		),
	)
}

interface Correction {
	label: string
	form: Modal
}

function plannedSession(date: string): SessionTemplate | null {
	const plan = planFor(date)
	return plan.kind === "strength" ? SESSIONS[plan.session] : null
}

function sessionCorrection(
	day: DayLog,
	log: readonly LogEntry[],
	rerender: (note?: string) => void,
): Correction | null {
	const session = (template: SessionTemplate | null, label: string) =>
		template && {
			label,
			form: sessionEditDialog(
				todaysSession(template, EXERCISES, log, day.date),
				day.date,
				log,
				rerender,
			),
		}
	const workout = (
		title: string,
		logged: ConditioningEntry | null,
		label: string,
	) => ({
		label,
		form: conditioningEditDialog(title, day.date, logged, rerender),
	})

	const set = day.strength[0]?.sets[0]
	if (set)
		return session(
			SESSIONS[set.session] ?? plannedSession(day.date),
			"Edit session",
		)
	const done = day.conditioning[0]
	if (done) return workout(done.category, done, "Edit workout")
	const plan = planFor(day.date)
	if (plan.kind === "strength")
		return session(SESSIONS[plan.session], "Log session")
	if (plan.kind === "conditioning")
		return workout(plan.title, null, "Log workout")
	return null
}

function corrections(
	day: DayLog,
	log: readonly LogEntry[],
	rerender: (note?: string) => void,
): Correction[] {
	const declared = day.skipped.some((entry) => entry.reason !== undefined)
	const session = declared ? null : sessionCorrection(day, log, rerender)
	return [
		...(session ? [session] : []),
		{
			label: day.wellness.length > 0 ? "Edit wellness" : "Log wellness",
			form: wellnessEditDialog(day.date, day.wellness, rerender),
		},
	]
}

function dayCorrection(
	day: DayLog,
	log: readonly LogEntry[],
	today: string,
	rerender: (note?: string) => void,
): Node[] {
	const actions = corrections(day, log, rerender)
	const links = actions.map(({ label, form }) => {
		const open = el(
			"button",
			{ type: "button", class: "link cursor-pointer text-sm font-bold" },
			[label],
		)
		open.addEventListener("click", () => {
			// The forms were built for the days this render found fresh.
			if (localDateOf(new Date()) !== today)
				rerender("The day changed — only today and yesterday can be edited.")
			else form.open()
		})
		return open
	})
	return [
		el("div", { class: "mt-3 flex flex-wrap gap-4" }, links),
		...actions.map(({ form }) => form.element),
	]
}

function dayPanel(day: DayLog, correction: readonly Node[]): HTMLElement {
	return el("li", { class: "panel" }, [
		el("div", { class: "flex items-baseline justify-between gap-3" }, [
			el("p", { class: "shrink-0 text-sm font-extrabold" }, [
				formatDayShort(day.date),
			]),
			el(
				"p",
				{
					class: `${day.skipped.length > 0 ? "text-primary" : MUTED} ${LABEL}`,
				},
				[day.labels.join(" · ")],
			),
		]),
		...day.skipped.map((entry) =>
			el("p", { class: "numeric mt-2 text-sm font-semibold" }, [
				el("span", { class: "font-extrabold" }, [entry.planned]),
				el("span", { class: MUTED }, [` ${skippedSummary(entry)}`]),
			]),
		),
		...day.strength.map(({ ref, sets }) =>
			el("p", { class: "numeric mt-2 text-sm font-semibold" }, [
				el("span", { class: "font-extrabold" }, [EXERCISES[ref]?.name ?? ref]),
				el("span", { class: MUTED }, [` ${sets.map(formatSet).join(" · ")}`]),
			]),
		),
		...day.conditioning.map((entry) =>
			el("p", { class: "numeric mt-2 text-sm font-semibold" }, [
				el("span", { class: "font-extrabold" }, [entry.workout]),
				el("span", { class: MUTED }, [` ${conditioningSummary(entry)}`]),
			]),
		),
		...day.wellness.map((entry) =>
			el("p", { class: "numeric mt-2 text-sm font-semibold" }, [
				el("span", { class: "font-extrabold" }, ["Wellness"]),
				el("span", { class: MUTED }, [` ${wellnessSummary(entry)}`]),
			]),
		),
		...correction,
	])
}
