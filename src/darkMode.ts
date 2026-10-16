export function onDarkModeChange(onChange: () => void): () => void {
	const root = document.documentElement
	let dark = root.classList.contains("dark")
	const observer = new MutationObserver(() => {
		// The toggle re-adds `dark` to an already dark page when it moves to the system theme
		if (root.classList.contains("dark") === dark) return
		dark = !dark
		onChange()
	})
	observer.observe(root, { attributes: true, attributeFilter: ["class"] })
	return () => observer.disconnect()
}
