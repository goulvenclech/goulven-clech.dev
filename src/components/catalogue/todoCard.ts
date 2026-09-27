import { formatTodoLabel, type TodoItem } from "$src/catalogue/todo"

export function todoCard(item: TodoItem): HTMLAnchorElement {
	const link = document.createElement("a")
	link.href = item.href
	link.title = formatTodoLabel(item)
	link.className =
		"no-icon bg-alt-light dark:bg-alt-dark relative aspect-3/4 overflow-hidden"
	if (!item.done) {
		link.classList.add("opacity-60", "grayscale")
		link.target = "_blank"
		link.rel = "noopener"
	}

	if (item.poster) {
		const img = document.createElement("img")
		img.src = item.poster
		img.alt = item.name
		img.loading = "lazy"
		// Drop the referrer to dodge CDN hotlink blocks.
		img.referrerPolicy = "no-referrer"
		img.className = "h-full w-full object-cover"
		img.addEventListener("error", () => img.replaceWith(placeholderFor(item)))
		link.appendChild(img)
	} else {
		link.appendChild(placeholderFor(item))
	}

	if (item.emoji) {
		const badge = document.createElement("span")
		badge.className = "absolute top-1 right-1 text-lg drop-shadow-md"
		badge.textContent = item.emoji
		link.appendChild(badge)
	}
	return link
}

function placeholderFor(item: TodoItem): HTMLSpanElement {
	const span = document.createElement("span")
	// Links don't wrap by default.
	span.className =
		"flex h-full w-full items-center justify-center p-2 text-center text-xs whitespace-normal"
	span.textContent = formatTodoLabel(item)
	return span
}
