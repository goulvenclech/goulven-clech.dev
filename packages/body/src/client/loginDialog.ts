import { el, type Modal } from "./dom"
import { requestSyncToken, sync } from "./sync"

const MUTED = "text-muted-light dark:text-muted-dark"
const TITLE_ID = "login-dialog-title"
const PASSWORD_ID = "sync-password"

export function loginDialog(
	onFinished: (authenticated: boolean) => void,
): Modal {
	const password = el("input", {
		id: PASSWORD_ID,
		type: "password",
		autocomplete: "current-password",
	})
	// Always rendered so screen readers announce failures reliably.
	const errorNote = el("p", {
		role: "alert",
		class: "text-primary mt-4 text-sm font-bold",
	})
	const cancel = el("button", { type: "button", class: "button-secondary" }, [
		"Cancel",
	])
	const submit = el("button", { type: "submit", class: "button-primary" }, [
		"Enable sync",
	])

	const form = el("form", {}, [
		el("h2", { id: TITLE_ID, class: "mt-0 mb-2 text-lg font-black" }, [
			"Enable sync",
		]),
		el("p", { class: `${MUTED} mb-5 text-sm font-bold` }, [
			"Optional — the log lives on this device either way.",
		]),
		el("div", {}, [
			el("label", { for: PASSWORD_ID }, ["Sync password"]),
			password,
		]),
		errorNote,
		el("div", { class: "mt-6 grid grid-cols-2 gap-3" }, [cancel, submit]),
	])
	const dialog = el("dialog", { "aria-labelledby": TITLE_ID }, [form])

	// Never leave the password sitting in the DOM once the dialog is done.
	const reset = () => {
		password.value = ""
		errorNote.textContent = ""
		submit.disabled = false
	}
	const finish = (authenticated: boolean) => {
		dialog.close()
		reset()
		onFinished(authenticated)
	}
	cancel.addEventListener("click", () => finish(false))

	form.addEventListener("submit", async (event) => {
		event.preventDefault()
		if (!password.value) {
			errorNote.textContent = "Type the sync password, or dismiss this."
			return
		}
		submit.disabled = true
		const auth = await requestSyncToken(password.value)
		if (auth === "ok") {
			await sync()
			finish(true)
			return
		}
		// Dismissed mid-request: sync simply stays off.
		if (dialog.open) {
			errorNote.textContent =
				auth === "unauthorized"
					? "Wrong password — sync stays off."
					: "Couldn't reach sync — try again."
			submit.disabled = false
		}
	})

	return {
		element: dialog,
		open: () => {
			reset()
			dialog.showModal()
		},
	}
}
