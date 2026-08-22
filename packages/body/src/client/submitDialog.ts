import { localDateOf } from "../dates"
import { appendEntries } from "../logStore"
import type { LogEntry, WellnessEntry } from "../schemas"
import { ZodError } from "zod"
import { DAY_ROLLED_OVER, STORAGE_BLOCKED, el, type Modal } from "./dom"
import { sync } from "./sync"
import { wellnessFields } from "./wellnessFields"

// Logging and skipping can share a day, so each dialog labels itself.
let dialogCount = 0

export type BuildResult =
	{ entries: LogEntry[] } | { error: string; focus?: HTMLElement }

export function submitDialog(options: {
	title: string
	submitLabel: string
	fields: readonly Node[]
	log: readonly LogEntry[]
	today: string
	/** Shown when the schema refuses the write. */
	invalidMessage: string
	build: (wellnessEntry: WellnessEntry | null) => BuildResult
	onSettled: (note?: string) => void
}): Modal {
	const { today, onSettled } = options
	const wellness = wellnessFields(options.log, today)
	const titleId = `log-dialog-title-${++dialogCount}`

	// Always rendered so screen readers announce failures reliably.
	const errorNote = el("p", {
		role: "alert",
		class: "text-primary text-sm font-bold",
	})
	const cancel = el("button", { type: "button", class: "button-secondary" }, [
		"Cancel",
	])
	const submit = el("button", { type: "submit", class: "button-primary" }, [
		options.submitLabel,
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
		el("h2", { id: titleId, class: "mt-0 mb-5 text-lg font-black" }, [
			options.title,
		]),
		...options.fields,
		...(wellness ? [wellness.element] : []),
		actions,
	])
	const dialog = el("dialog", { "aria-labelledby": titleId }, [form])

	cancel.addEventListener("click", () => dialog.close())

	form.addEventListener("submit", async (event) => {
		event.preventDefault()
		// Append-only: a write under yesterday's date could never be corrected.
		if (localDateOf(new Date()) !== today) {
			dialog.close()
			onSettled(DAY_ROLLED_OVER)
			return
		}

		const built = options.build(wellness?.entry() ?? null)
		if ("error" in built) {
			errorNote.textContent = built.error
			built.focus?.focus()
			return
		}

		submit.disabled = true
		try {
			await appendEntries(built.entries)
			void sync()
			dialog.close()
			onSettled()
		} catch (error) {
			const message =
				error instanceof ZodError
					? options.invalidMessage
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
