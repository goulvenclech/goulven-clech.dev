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
 * Years of remote work experience since March 2018.
 * Game Dev Alliance, while not being a professional job, was a true remote work experience
 * with Erika being in Canada and me in France, where I learned a lot about async collaboration.
 */
export function getRemoteWorkYears(): number {
	const remoteWorkStartYear = 2018
	const currentYear = new Date().getFullYear()
	// Started in March (month index 2)
	const anniversaryThisYear = new Date(currentYear, 2, 1)
	// If the anniversary hasn't happened yet this year, subtract one year
	return (
		currentYear -
		remoteWorkStartYear -
		(anniversaryThisYear > new Date() ? 1 : 0)
	)
}

/**
 * Format a date range as a human-readable string (e.g. "January 2020 - March 2021").
 */
export function formatDateRange(startDate: Date, endDate?: Date): string {
	const formattedStart = startDate.toLocaleString("en-GB", {
		month: "long",
		year: "numeric",
	})
	const formattedEnd = endDate?.toLocaleString("en-GB", {
		month: "long",
		year: "numeric",
	})
	if (!endDate) return `${formattedStart} - Present`
	if (formattedStart === formattedEnd) return formattedStart
	if (startDate.getFullYear() === endDate.getFullYear()) {
		return `${startDate.toLocaleString("en-GB", { month: "long" })} - ${formattedEnd}`
	}
	return `${formattedStart} - ${formattedEnd}`
}

/**
 * Sort comparator for experience entries, most recent first.
 * Entries without an end date (current positions) come before entries with one.
 */
export function sortExperiencesByDate(
	a: { data: { start_date: Date; end_date?: Date } },
	b: { data: { start_date: Date; end_date?: Date } },
): number {
	if (a.data.end_date && b.data.end_date) {
		return b.data.end_date.getTime() - a.data.end_date.getTime()
	} else if (!a.data.end_date && !b.data.end_date) {
		return b.data.start_date.getTime() - a.data.start_date.getTime()
	} else {
		return a.data.end_date ? 1 : -1
	}
}
