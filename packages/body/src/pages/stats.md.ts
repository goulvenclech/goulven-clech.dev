import type { APIContext } from "astro"
import { localDateOf } from "../dates"
import { formatHours } from "../duration"
import { EXERCISES, WEEKLY_PLAN } from "../program"
import { fetchLog } from "../remoteLog"
import {
	ADHERENCE_DAYS,
	TREND_WEEKS,
	WELLNESS_DAYS,
	adherence,
	dailyWellnessTrend,
	oneRepMaxTrends,
	roundKg,
	weeklyTonnage,
	type Adherence,
	type DailyTrend,
	type OneRepMaxTrend,
	type WeeklyPoint,
} from "../stats"

export const prerender = false

export interface StatsView {
	site: string
	attendance: Adherence
	sleep: DailyTrend
	steps: DailyTrend
	trends: OneRepMaxTrend[]
	tonnage: WeeklyPoint[]
}

const series = (
	values: readonly (number | null)[],
	format: (value: number) => string,
): string =>
	values.map((value) => (value === null ? "—" : format(value))).join(" · ")

const rounded = (value: number) => String(Math.round(value))

function wellnessLine(
	label: string,
	trend: DailyTrend,
	format: (value: number) => string,
	empty: string,
	averageUnit = "",
): string {
	if (trend.average === null) return `- ${label}: ${empty}`
	const logged = trend.points.filter((point) => point.value !== null).length
	const first = trend.points[0].date
	const last = trend.points[trend.points.length - 1].date
	return `- ${label}: ${format(trend.average)}${averageUnit} average over ${logged} logged ${logged === 1 ? "day" : "days"}. Daily (${first} → ${last}): ${series(
		trend.points.map((point) => point.value),
		format,
	)}`
}

function trendLine(trend: OneRepMaxTrend): string {
	const latest = [...trend.points]
		.reverse()
		.find((point) => point.value !== null)?.value
	const first = trend.points[0].week
	const last = trend.points[trend.points.length - 1].week
	return `- ${trend.exercise.name}: latest ${latest == null ? "—" : `${roundKg(latest)} kg`}. Weekly best (${first} → ${last}): ${series(
		trend.points.map((point) => point.value),
		(value) => String(roundKg(value)),
	)}`
}

export function renderStatsMd(view: StatsView): string {
	const { site, attendance, sleep, steps, trends, tonnage } = view

	const tonnageLine = `Total kg per week (${tonnage[0].week} → ${tonnage[tonnage.length - 1].week}): ${series(
		tonnage.map((point) => point.value),
		rounded,
	)}`

	return [
		"# Body — stats",
		"",
		`Markdown twin of ${site}/stats/, for crawlers, LLMs, and no-JS readers. Site entry and today's session: ${site}/index.md. Full log by day: ${site}/log.md. Site map: ${site}/llms.txt.`,
		"",
		`## Adherence — last ${ADHERENCE_DAYS} days`,
		"",
		`${Math.round(attendance.ratio * 100)}% — ${attendance.done}/${attendance.planned} scheduled sessions.`,
		"",
		`## Wellness — last ${WELLNESS_DAYS} days`,
		"",
		wellnessLine("Sleep", sleep, formatHours, "No sleep logged yet."),
		wellnessLine("Steps", steps, rounded, "No steps logged yet.", " steps"),
		"",
		`## Estimated 1RM — ${TREND_WEEKS} weeks, Epley, best per week`,
		"",
		trends.length === 0
			? "No sets logged yet."
			: trends.map(trendLine).join("\n"),
		"",
		`## Weekly tonnage — ${TREND_WEEKS} weeks`,
		"",
		tonnageLine,
		"",
	].join("\n")
}

export async function GET(context: APIContext): Promise<Response> {
	try {
		const site = context.site!.origin
		const today = localDateOf(new Date())
		const { entries } = await fetchLog()

		const document = renderStatsMd({
			site,
			attendance: adherence(entries, WEEKLY_PLAN, today),
			sleep: dailyWellnessTrend(entries, "sleepHours", today),
			steps: dailyWellnessTrend(entries, "steps", today),
			trends: oneRepMaxTrends(entries, EXERCISES, today),
			tonnage: weeklyTonnage(entries, EXERCISES, today),
		})

		return new Response(document, {
			status: 200,
			headers: {
				"Content-Type": "text/markdown; charset=utf-8",
				"Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
				Link: `<${site}/stats/>; rel="canonical"`,
				"X-Robots-Tag": "noindex",
			},
		})
	} catch (err) {
		console.error("GET /stats.md failed:", err)
		return new Response("Unable to load stats", {
			status: 500,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		})
	}
}
