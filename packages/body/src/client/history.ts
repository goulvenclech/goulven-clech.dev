import { formatDayShort, localDateOf } from "../dates"
import { mergeEntries, pendingCount, readLog } from "../logStore"
import { EXERCISES, SESSIONS } from "../program"
import type { LogEntry, StrengthEntry } from "../schemas"
import { STORAGE_BLOCKED, el, formatSet, storageErrorNote } from "./dom"
import { requestSyncToken, sync, syncToken } from "./sync"

const MUTED = "text-muted-light dark:text-muted-dark"

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
	const pending = await pendingCount().catch(() => 0)
	const rerender = (nextNote?: string) => renderHistory(root, false, nextNote)

	const errorNote = el(
		"p",
		{ role: "alert", class: "text-primary mt-3 text-sm font-bold" },
		note ? [note] : [],
	)
	const toolbar = el("div", { class: "mt-8 flex justify-between gap-2" }, [
		syncControls(pending, errorNote, rerender),
		el("div", { class: "flex gap-2" }, [
			// Import stays available on an empty log: that is when a backup matters.
			importButton(errorNote, rerender),
			...(log.length > 0 ? [exportButton(log)] : []),
		]),
	])

	// No in-progress inputs on this screen, so a re-render is safe.
	if (autoSync)
		void sync().then((result) => {
			if (result.pulled > 0 || result.pushed > 0) rerender()
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
	const strength = entries.filter(
		(entry): entry is StrengthEntry => entry.kind === "strength",
	)
	const byExercise = new Map<string, StrengthEntry[]>()
	for (const entry of strength) {
		const sets = byExercise.get(entry.ref) ?? []
		sets.push(entry)
		byExercise.set(entry.ref, sets)
	}

	const labels = [
		...new Set(
			entries.map((entry) =>
				entry.kind === "strength"
					? (SESSIONS[entry.session]?.name ?? entry.session)
					: "Conditioning",
			),
		),
	]

	return el("li", { class: "panel" }, [
		el("div", { class: "flex items-baseline justify-between gap-3" }, [
			el("p", { class: "text-sm font-extrabold" }, [formatDayShort(date)]),
			el(
				"p",
				{ class: `${MUTED} text-xs font-extrabold tracking-widest uppercase` },
				[labels.join(" · ")],
			),
		]),
		...[...byExercise.entries()].map(([ref, sets]) =>
			el("p", { class: "numeric mt-2 text-sm font-semibold" }, [
				el("span", { class: "font-extrabold" }, [EXERCISES[ref]?.name ?? ref]),
				el("span", { class: MUTED }, [
					` ${sets
						.sort((a, b) => a.set - b.set)
						.map(formatSet)
						.join(" · ")}`,
				]),
			]),
		),
		...entries
			.filter((entry) => entry.kind === "conditioning")
			.map((entry) =>
				el("p", { class: "numeric mt-2 text-sm font-semibold" }, [
					`${entry.workout} — level ${entry.level} · ${entry.sets} sets`,
				]),
			),
	])
}

function syncControls(
	pending: number,
	errorNote: HTMLElement,
	onSynced: (note?: string) => void,
): HTMLElement {
	if (syncToken()) {
		const status = el(
			"p",
			{ class: `${MUTED} numeric self-center text-xs font-extrabold` },
			[pending > 0 ? `Sync · ${pending} pending` : "Sync on"],
		)
		const button = el("button", { class: "button-ghost" }, ["Sync now"])
		button.addEventListener("click", async () => {
			button.disabled = true
			const result = await sync()
			onSynced(
				result.offline
					? "Offline — will retry on the next visit."
					: result.authRequired
						? "Sync password needed again."
						: result.rejected
							? "The server refused some entries — they stay on this device."
							: undefined,
			)
		})
		return el("div", { class: "flex gap-2" }, [status, button])
	}

	const password = el("input", {
		type: "password",
		placeholder: "Sync password",
		autocomplete: "current-password",
		class: "w-40!",
		"aria-label": "Sync password",
	})
	const enable = el("button", { class: "button-ghost" }, ["Enable sync"])
	enable.addEventListener("click", async () => {
		if (!password.value) return
		enable.disabled = true
		const auth = await requestSyncToken(password.value)
		if (auth === "ok") {
			await sync()
			onSynced()
		} else {
			errorNote.textContent =
				auth === "unauthorized"
					? "Wrong password — sync stays off."
					: "Couldn't reach sync — try again."
			enable.disabled = false
		}
	})
	return el("div", { class: "flex gap-2" }, [password, enable])
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
