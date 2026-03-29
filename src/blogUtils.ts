import semver from "semver"

/**
 * Determines whether an entry should be shown.
 */
export function isEntryPublished(
	published: string,
	strict: boolean = false,
): boolean {
	if (import.meta.env.PROD || strict) {
		// In strict mode or in production, we filter out "never", "draft" and versions higher than the current version.
		return (
			published !== "never" &&
			published !== "draft" &&
			semver.lte(published, import.meta.env.npm_package_version)
		)
	} else {
		// In non-strict mode, only "never" entries are filtered out.
		return published !== "never"
	}
}

/**
 * Returns true if the given entry is the first April entry of its year
 */
export function isFirstAprilEntry(
	entry: { id: string; date: Date },
	allEntries: { id: string; date: Date }[],
): boolean {
	if (entry.date.getUTCMonth() !== 3) return false

	const year = entry.date.getUTCFullYear()
	const aprilEntries = allEntries
		.filter(
			(e) => e.date.getUTCMonth() === 3 && e.date.getUTCFullYear() === year,
		)
		.sort((a, b) => a.date.getTime() - b.date.getTime())

	return aprilEntries[0]?.id === entry.id
}

export interface BlogEntry {
	id: string
	title: string
	date: string
	year: number
	tags: string[]
	abstract: string
	image?: { src: string }
	imageDark?: { src: string }
	imageAlt: string
	imagePlaceholder?: string
	imageDarkPlaceholder?: string
	isPublished: boolean
	imageFocusY?: number
}
