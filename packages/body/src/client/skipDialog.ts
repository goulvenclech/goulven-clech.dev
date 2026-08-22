import {
	LOG_SCHEMA_VERSION,
	type LogEntry,
	type SkippedEntry,
} from "../schemas"
import { el, type Modal } from "./dom"
import { submitDialog } from "./submitDialog"

export function skipDialog(
	planned: string,
	today: string,
	log: readonly LogEntry[],
	onSettled: (note?: string) => void,
): Modal {
	const reason = el("input", {
		id: "skip-reason",
		type: "text",
		maxlength: "200",
		required: "",
	})

	return submitDialog({
		title: `Skip ${planned}`,
		submitLabel: "Skip session",
		fields: [
			el("div", {}, [el("label", { for: "skip-reason" }, ["Reason"]), reason]),
		],
		log,
		today,
		invalidMessage: "Could not save — check the reason.",
		onSettled,
		build: (wellnessEntry) => {
			const written = reason.value.trim()
			// A skip without a reason is what an unlogged day already looks like.
			if (!written)
				return { error: "Say why the session is skipped.", focus: reason }
			const entry: SkippedEntry = {
				kind: "skipped",
				schemaVersion: LOG_SCHEMA_VERSION,
				id: crypto.randomUUID(),
				date: today,
				planned,
				reason: written,
			}
			return { entries: wellnessEntry ? [entry, wellnessEntry] : [entry] }
		},
	})
}
