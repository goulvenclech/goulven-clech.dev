const MINUTES_PER_HOUR = 60
const SECONDS_PER_MINUTE = 60

const pad = (value: number) => String(value).padStart(2, "0")

export function hoursParts(hours: number): [lead: string, tail: string] {
	const total = Math.round(hours * MINUTES_PER_HOUR)
	const whole = Math.floor(total / MINUTES_PER_HOUR)
	const minutes = total % MINUTES_PER_HOUR
	if (whole === 0) return [String(minutes), " min"]
	return [String(whole), minutes === 0 ? " h" : ` h ${pad(minutes)}`]
}

export function formatHours(hours: number): string {
	return hoursParts(hours).join("")
}

export function formatSeconds(seconds: number): string {
	const whole = Math.floor(seconds / SECONDS_PER_MINUTE)
	const rest = seconds % SECONDS_PER_MINUTE
	if (whole === 0) return `${rest} s`
	return rest === 0 ? `${whole} min` : `${whole} min ${pad(rest)}`
}

export function hoursOf(hours: number, minutes: number): number {
	return (hours * MINUTES_PER_HOUR + minutes) / MINUTES_PER_HOUR
}
