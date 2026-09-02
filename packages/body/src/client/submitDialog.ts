import { localDateOf } from "../dates"
import { appendEntries, readLog } from "../logStore"
import type { LogEntry, WellnessEntry } from "../schemas"
import { ZodError } from "zod"
import { DAY_ROLLED_OVER, STORAGE_BLOCKED, el, type Modal } from "./dom"
import { sync } from "./sync"
import type { WellnessFields } from "./wellnessFields"

// Logging and skipping can share a day, so each dialog labels itself.
let dialogCount = 0

/** Empty entries mean nothing to write: the dialog just closes. */
export type BuildResult =
	{ entries: LogEntry[] } | { error: string; focus?: HTMLElement }

export function submitDialog(options: {
	title: string
	submitLabel: string
	fields: readonly Node[]
	wellness: WellnessFields | null
	/** Shown when the schema refuses the write. */
	invalidMessage: string
	/** Handed the log as it stands at the write, not as the form was built. */
	build: (
		wellnessEntry: WellnessEntry | null,
		log: readonly LogEntry[],
	) => BuildResult
	onSettled: (note?: string) => void
}): Modal {
	const { wellness, onSettled } = options
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

	// Left open overnight, the form would write about a day the screen no longer shows.
	let openedOn = localDateOf(new Date())

	form.addEventListener("submit", async (event) => {
		event.preventDefault()
		if (localDateOf(new Date()) !== openedOn) {
			dialog.close()
			onSettled(DAY_ROLLED_OVER)
			return
		}

		submit.disabled = true
		try {
			const built = options.build(wellness?.entry() ?? null, await readLog())
			if ("error" in built) {
				errorNote.textContent = built.error
				submit.disabled = false
				built.focus?.focus()
				return
			}
			if (built.entries.length === 0) {
				dialog.close()
				onSettled()
				return
			}
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
			openedOn = localDateOf(new Date())
			dialog.showModal()
		},
	}
}
