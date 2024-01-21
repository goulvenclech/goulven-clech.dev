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
  // In "showing" mode, we filter out "never", "hidden", "draft" and versions higher than the current version.
  if (strict) {
    return (
      published !== "never" &&
      published !== "draft" &&
      published !== "hidden" &&
      semver.lte(published, import.meta.env.npm_package_version)
    )
    // But in "parsing" mode, based on the environment
  } else {
    if (import.meta.env.DEV) {
      // In dev mode, we want to parse everything. So we can access it by URL.
      return true
    } else {
      // In prod mode, we don't want to parse entries with "never", "draft", and versions higher than the current version.
      // Hidden entries are parsed, so they can be accessed by URL.
      return (
        published !== "never" &&
        published !== "draft" &&
        semver.lte(published, import.meta.env.npm_package_version)
      )
    }
  }
}
