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

export const STORAGE_BLOCKED =
	"this browser is blocking storage (full or private mode?)"

export function formatSet(set: {
	kg: number
	reps: number
	unit?: "reps" | "m" | "s"
}): string {
	const unit = set.unit ?? "reps"
	if (unit === "reps") return `${set.kg} kg × ${set.reps}`
	return set.kg > 0
		? `${set.kg} kg × ${set.reps} ${unit}`
		: `${set.reps} ${unit}`
}

export function storageErrorNote(): HTMLElement {
	return el(
		"p",
		{ role: "alert", class: "text-primary mt-8 text-sm font-bold" },
		[`Could not open the log — ${STORAGE_BLOCKED}.`],
	)
}
