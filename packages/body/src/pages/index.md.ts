import type { APIContext } from "astro"
import { localDateOf, weekdayName } from "../dates"
import {
	conditioningSummary,
	formatSet,
	guidanceFor,
	plannedSummary,
	skippedOf,
	skippedSummary,
	targetSummary,
} from "../dayLog"
import { todaysSession, type DaySession } from "../engine"
import { EXERCISES, SESSIONS, planFor } from "../program"
import { fetchLog } from "../remoteLog"
import type {
	ConditioningEntry,
	LogEntry,
	PlanDay,
	SkippedEntry,
} from "../schemas"

export const prerender = false

export interface IndexView {
	site: string
	date: string
	day: PlanDay
	session: DaySession | null
	conditioningLogged: ConditioningEntry | null
	skipped: SkippedEntry | null
}

function renderIntro(site: string): string {
	return [
		"# Body",
		"",
		"Goulven Clec'h's personal workout tracker: strength sessions at the gym, conditioning workouts at home, and daily wellness (sleep hours, steps), with automated agenda and double progression.",
		"",
		`Markdown entry point of ${site}/, for crawlers, LLMs, and no-JS readers. Full log by day: ${site}/log.md. Adherence, wellness, 1RM, and tonnage: ${site}/stats.md. What this is and who it is for: ${site}/about/. Site map: ${site}/llms.txt. Main site: https://goulven-clech.dev/llms.txt.`,
	].join("\n")
}

export function renderTodaySection(view: IndexView): string {
	const heading = `## Today — ${view.date} (${weekdayName(view.date)})`
	if (view.day.kind === "rest")
		return [heading, "", "Rest day — nothing to log."].join("\n")
	if (view.skipped)
		return [
			heading,
			"",
			`${view.skipped.planned} skipped — ${skippedSummary(view.skipped)}.`,
		].join("\n")
	if (view.day.kind === "conditioning")
		return [
			heading,
			"",
			`Conditioning at home: ${view.day.title}.`,
			...(view.conditioningLogged
				? [
						`Done: ${view.conditioningLogged.workout} · ${conditioningSummary(view.conditioningLogged)}.`,
					]
				: []),
		].join("\n")
	return [
		heading,
		"",
		`Strength at the gym — session ${view.session!.id}.`,
		"",
		...view.session!.exercises.map((plan) => {
			const done =
				plan.loggedToday.length > 0
					? ` · done: ${plan.loggedToday.map(formatSet).join(" · ")}`
					: ""
			return `- ${plan.exercise.name}: target ${targetSummary(plan)} · ${plannedSummary(plan.planned)} · ${guidanceFor(plan)}${done}`
		}),
	].join("\n")
}

export function renderBodyIndex(view: IndexView): string {
	return [renderIntro(view.site), "", renderTodaySection(view), ""].join("\n")
}

export function buildIndexView(
	site: string,
	date: string,
	day: PlanDay,
	entries: readonly LogEntry[],
): IndexView {
	return {
		site,
		date,
		day,
		session:
			day.kind === "strength"
				? todaysSession(SESSIONS[day.session], EXERCISES, entries, date)
				: null,
		skipped:
			skippedOf(entries.filter((entry) => entry.date === date))[0] ?? null,
		conditioningLogged:
			day.kind === "conditioning"
				? (entries.find(
						(entry): entry is ConditioningEntry =>
							entry.kind === "conditioning" && entry.date === date,
					) ?? null)
				: null,
	}
}

export async function GET(context: APIContext): Promise<Response> {
	try {
		const site = context.site!.origin
		const date = localDateOf(new Date())
		const { entries } = await fetchLog()
		const document = renderBodyIndex(
			buildIndexView(site, date, planFor(date), entries),
		)

		return new Response(document, {
			status: 200,
			headers: {
				"Content-Type": "text/markdown; charset=utf-8",
				"Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
				Link: `<${site}/>; rel="canonical"`,
				"X-Robots-Tag": "noindex",
			},
		})
	} catch (err) {
		console.error("GET /index.md failed:", err)
		return new Response("Unable to load today", {
			status: 500,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		})
	}
}
