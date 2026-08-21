import { formatDayShort, localDateOf } from "../dates"
import { mergeEntries, readLog } from "../logStore"
import { EXERCISES, SESSIONS } from "../program"
import type {
	ConditioningEntry,
	LogEntry,
	StrengthEntry,
	WellnessEntry,
} from "../schemas"
import { STORAGE_BLOCKED, el, formatSet, storageErrorNote } from "./dom"
import { loginDialog } from "./loginDialog"
import { sync, syncToken, takeAbandoned } from "./sync"

const MUTED = "text-muted-light dark:text-muted-dark"

function syncNote(abandoned: number, rejected: boolean): string | undefined {
	if (abandoned > 0)
		return `${abandoned} ${abandoned === 1 ? "entry" : "entries"} could not be synced and will stay on this device.`
	if (rejected) return "Sync is failing — it will try again on the next visit."
	return undefined
}

export async function renderHistory(
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
	const rerender = (nextNote?: string) => renderHistory(root, false, nextNote)

	const errorNote = el(
		"p",
		{ role: "alert", class: "text-primary mt-3 text-sm font-bold" },
		note ? [note] : [],
	)
	const enableSync = enableSyncControl(rerender)
	const toolbar = el("div", { class: "mt-8 flex flex-wrap gap-2" }, [
		...(enableSync ? [enableSync] : []),
		// Import stays available on an empty log: that is when a backup matters.
		importButton(errorNote, rerender),
		...(log.length > 0 ? [exportButton(log)] : []),
	])

	// No in-progress inputs on this screen, so a re-render is safe.
	if (autoSync)
		void sync().then((result) => {
			const failure = syncNote(takeAbandoned(), result.rejected)
			// A 401 wiped the token after this render: rerender so "Enable sync"
			// comes back. Without a token at render time the control is already
			// there, and authRequired is the normal pending state — stay quiet.
			if (result.authRequired && !enableSync)
				rerender(failure ?? "Sync password needed again.")
			else if (result.pulled > 0 || result.pushed > 0) rerender(failure)
			else if (failure) errorNote.textContent = failure
		})

	if (log.length === 0) {
		root.replaceChildren(
			toolbar,
			errorNote,
			el("p", { class: `${MUTED} mt-4 text-sm font-bold` }, [
				"Nothing logged yet.",
			]),
		)
		return
	}

	const byDate = new Map<string, LogEntry[]>()
	for (const entry of log) {
		const day = byDate.get(entry.date) ?? []
		day.push(entry)
		byDate.set(entry.date, day)
	}
	const days = [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a))

	root.replaceChildren(
		toolbar,
		errorNote,
		el(
			"ul",
			{ class: "mt-4 space-y-3" },
			days.map(([date, entries]) => dayPanel(date, entries)),
		),
	)
}

function dayPanel(date: string, entries: LogEntry[]): HTMLElement {
	// The log carries no time of day, so the templates are the only stable order.
	const plannedOrder = (entry: StrengthEntry) => {
		const index = SESSIONS[entry.session]?.exercises.findIndex(
			(planned) => planned.ref === entry.ref,
		)
		return index === undefined || index < 0 ? Number.MAX_SAFE_INTEGER : index
	}

	const strength = entries
		.filter((entry): entry is StrengthEntry => entry.kind === "strength")
		.sort(
			(a, b) =>
				a.session.localeCompare(b.session) ||
				plannedOrder(a) - plannedOrder(b) ||
				a.set - b.set,
		)
	const conditioning = entries
		.filter(
			(entry): entry is ConditioningEntry => entry.kind === "conditioning",
		)
		.sort(
			(a, b) =>
				a.category.localeCompare(b.category) ||
				a.workout.localeCompare(b.workout),
		)
	const wellness = entries.filter(
		(entry): entry is WellnessEntry => entry.kind === "wellness",
	)

	const byExercise = new Map<string, StrengthEntry[]>()
	for (const entry of strength) {
		const sets = byExercise.get(entry.ref) ?? []
		sets.push(entry)
		byExercise.set(entry.ref, sets)
	}

	const labels = [
		...new Set([
			...(strength.length > 0 ? ["Strength"] : []),
			...conditioning.map((entry) => entry.category),
		]),
	]

	return el("li", { class: "panel" }, [
		el("div", { class: "flex items-baseline justify-between gap-3" }, [
			el("p", { class: "shrink-0 text-sm font-extrabold" }, [
				formatDayShort(date),
			]),
			el(
				"p",
				{
					class: `${MUTED} min-w-0 truncate text-xs font-extrabold tracking-widest uppercase`,
				},
				[labels.join(" · ")],
			),
		]),
		...[...byExercise.entries()].map(([ref, sets]) =>
			el("p", { class: "numeric mt-2 text-sm font-semibold" }, [
				el("span", { class: "font-extrabold" }, [EXERCISES[ref]?.name ?? ref]),
				el("span", { class: MUTED }, [` ${sets.map(formatSet).join(" · ")}`]),
			]),
		),
		...conditioning.map((entry) =>
			el("p", { class: "numeric mt-2 text-sm font-semibold" }, [
				el("span", { class: "font-extrabold" }, [entry.workout]),
				el("span", { class: MUTED }, [
					` level ${entry.level} · ${entry.sets} sets`,
				]),
			]),
		),
		...wellness.map((entry) =>
			el("p", { class: "numeric mt-2 text-sm font-semibold" }, [
				el("span", { class: "font-extrabold" }, ["Wellness"]),
				el("span", { class: MUTED }, [
					" " +
						[
							...(entry.sleepHours === undefined
								? []
								: [`${entry.sleepHours} h sleep`]),
							...(entry.steps === undefined ? [] : [`${entry.steps} steps`]),
						].join(" · "),
				]),
			]),
		),
	])
}

function enableSyncControl(onEnabled: () => void): HTMLElement | null {
	if (syncToken()) return null

	const login = loginDialog((authenticated) => {
		if (authenticated) onEnabled()
	})
	const enable = el("button", { class: "button-ghost" }, ["Enable sync"])
	enable.addEventListener("click", login.open)
	return el("div", { class: "flex gap-2" }, [enable, login.element])
}

function exportButton(log: LogEntry[]): HTMLElement {
	const button = el("button", { class: "button-ghost" }, ["Export JSON"])
	button.addEventListener("click", () => {
		const blob = new Blob([JSON.stringify(log, null, "\t")], {
			type: "application/json",
		})
		const url = URL.createObjectURL(blob)
		const link = el("a", {
			href: url,
			download: `body-log-${localDateOf(new Date())}.json`,
		})
		link.click()
		// Revoking in the same task can cancel the download (notably WebKit);
		// give the browser time to capture the blob first.
		setTimeout(() => URL.revokeObjectURL(url), 1000)
	})
	return button
}

function importButton(
	errorNote: HTMLElement,
	onImported: () => void,
): HTMLElement {
	const input = el("input", {
		type: "file",
		accept: "application/json,.json",
		class: "sr-only",
		"aria-hidden": "true",
		tabindex: "-1",
	})
	const button = el("button", { class: "button-ghost" }, ["Import JSON"])
	button.addEventListener("click", () => input.click())
	input.addEventListener("change", async () => {
		const file = input.files?.[0]
		// Clear now, before any await: re-picking the same file after a failure
		// would otherwise never fire change again.
		input.value = ""
		if (!file) return
		try {
			const parsed: unknown = JSON.parse(await file.text())
			if (!Array.isArray(parsed) || parsed.length === 0)
				throw new Error("expected a non-empty array")
			const added = await mergeEntries(parsed, { queue: true })
			void sync()
			if (added === 0) {
				errorNote.textContent = "Nothing new to import."
				return
			}
			onImported()
		} catch (error) {
			errorNote.textContent =
				error instanceof DOMException
					? `Import failed — ${STORAGE_BLOCKED}.`
					: "Import failed — not a valid log export."
		}
	})
	return el("span", {}, [input, button])
}
