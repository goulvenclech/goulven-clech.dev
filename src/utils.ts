import semver from "semver"

/**
 * Return date in the format DD Month YYYY.
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * Determines whether an entry should be shown.
 */
export function isEntryPublished(published: string, strict: boolean = false): boolean {
	if (import.meta.env.PROD || strict ) {
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
 * In case I forget how old I am.
 */
export function getMyAge(): number {
  const myBirthYear = 1997
  const currentYear = new Date().getFullYear()
  // I'm born the 15th of November, but months are 0-indexed in JS
  const myBirthdayThisYear = new Date(currentYear, 10, 15)
  // If my birthday hasn't happened yet this year, I'm still one year younger
  return currentYear - myBirthYear - (myBirthdayThisYear > new Date() ? 1 : 0)
}


/**
 * Reads a mandatory environment variable or throws if it is missing.
 */
export function env(key: string): string {
  const value = import.meta.env[key] as string
  if (!value) throw new Error(`Environment variable "${key}" is not set`)
  return value as string
}
