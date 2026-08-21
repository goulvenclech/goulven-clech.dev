type Child = Node | string

export function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attributes: Record<string, string> = {},
	children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag)
	for (const [name, value] of Object.entries(attributes))
		element.setAttribute(name, value)
	element.append(...children)
	return element
}

/** Opening clears stale feedback: not every engine dispatches `close`. */
export interface Modal {
	element: HTMLDialogElement
	open: () => void
}

export const STORAGE_BLOCKED =
	"this browser is blocking storage (full or private mode?)"

export const DAY_ROLLED_OVER =
	"The day changed before you logged — nothing was saved."

/** Shared with AppLayout, which renders the elements this fills. */
export const PAGE_TITLE_ID = "page-title"
export const PAGE_SUBTITLE_ID = "page-subtitle"

export function storageErrorNote(): HTMLElement {
	return el(
		"p",
		{ role: "alert", class: "text-primary mt-8 text-sm font-bold" },
		[`Could not open the log — ${STORAGE_BLOCKED}.`],
	)
}

export function setPageHeader(title: string, subtitle: string): void {
	const setText = (id: string, text: string) => {
		const element = document.getElementById(id)
		if (element) element.textContent = text
	}
	setText(PAGE_TITLE_ID, title)
	setText(PAGE_SUBTITLE_ID, subtitle)
}
