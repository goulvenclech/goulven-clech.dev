import semver from "semver"

/**
 * Return date in the format DD Month YYYY.
 * @param {Date} date - What's the date to format?
 * @return {string} - The formated date
 */
export function formatDate(date: Date): string {
  return date.toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

/**
 * Should we show/parse this entry?
 * @param {string} published - Either "never", "draft", "hidden" or a valid semver version. Defaults to "never".
 * @param {boolean} strict - Is this "showing" mode (true) or "parsing" mode (false)? Defaults to false.
 * @return {boolean} - Is this entry published?
 */
export function isEntryPublished(published: string, strict: boolean = false): boolean {
  // In all cases, "hidden" are parsed, but never shown.
  if (import.meta.env.DEV) {
    // In dev mode, we don't want to show "never" entries.
    if (strict) {
      return published !== "never" && published !== "hidden"
      // But we want to parse them (they will me available by URL)
    } else {
      return true
    }
  } else {
    // In prod mode, we don't want to show "never" or "draft" entries.
    if (strict) {
      return published !== "never" && published !== "draft" && published !== "hidden"
    } else {
      // And we don't want to parse them (they won't be available by URL)
      // Also, filters out entries with a version higher than the current version.
      return (
        published !== "never" &&
        published !== "draft" &&
        semver.gt(published, import.meta.env.npm_package_version)
      )
    }
  }
}
