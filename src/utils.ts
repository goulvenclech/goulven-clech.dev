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
 * Should we show/parse this entry?
 * @param {string} published - Either "never", "draft", or a valid semver version. Defaults to "never".
 * @param {boolean} strict - Is this "showing" mode (true) or "parsing" mode (false)? Defaults to false.
 * @return {boolean} - Is this entry published?
 */
export function isEntryPublished(published: string, strict: boolean = false): boolean {
  // In "showing" mode, we filter out "never", "draft" and versions higher than the current version.
  if (strict) {
    return (
      published !== "never" &&
      published !== "draft" &&
      semver.lte(published, import.meta.env.npm_package_version)
    )
    // But in "parsing" mode, based on the environment
  } else {
    if (import.meta.env.DEV) {
      // In dev mode, we want to parse everything. So we can access it by URL.
      return true
    } else {
      // In prod mode, we don't want to parse entries with "never", "draft", and versions higher than the current version.
      return (
        published !== "never" &&
        published !== "draft" &&
        semver.lte(published, import.meta.env.npm_package_version)
      )
    }
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
