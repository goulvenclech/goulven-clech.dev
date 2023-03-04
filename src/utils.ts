/**
 * Return date in the format DD Month YYYY.
 * @param {Date} date - What's the date to format?
 * @return {string} - The formated date
 */
export function formatDate(date: Date): string {
  return date.toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}
