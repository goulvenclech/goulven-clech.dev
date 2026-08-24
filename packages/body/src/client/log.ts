import { formatDayShort } from "../dates"
import {
	conditioningSummary,
	formatSet,
	groupByDay,
	skippedSummary,
	wellnessSummary,
	type DayLog,
} from "../dayLog"
import { readLog } from "../logStore"
import { EXERCISES } from "../program"
import type { LogEntry } from "../schemas"
import { el, storageErrorNote } from "./dom"
import { sync, syncToken, takeAbandoned } from "./sync"

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

	// No in-progress inputs on this screen, so a re-render is safe.
	if (autoSync)
		void sync().then((result) => {
			const failure = syncNote(takeAbandoned(), result.rejected)
			const nextNote =
				result.authRequired && hadToken
					? (failure ?? "Sync password needed again.")
					: failure
			if (result.pulled > 0 || result.pushed > 0) rerender(nextNote)
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

	root.replaceChildren(
		errorNote,
		el("ul", { class: "mt-4 space-y-3" }, groupByDay(log).map(dayPanel)),
	)
}

function dayPanel(day: DayLog): HTMLElement {
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
	])
}
