import type { APIContext } from "astro"
import { weekdayName } from "../dates"
import {
	conditioningSummary,
	formatSet,
	groupByDay,
	skippedSummary,
	wellnessSummary,
	type DayLog,
} from "../dayLog"
import { exerciseByRef } from "../program"
import { fetchLog } from "../remoteLog"

export const prerender = false

const DEFAULT_LIMIT = 14
const MAX_LIMIT = 90

export interface ParsedLogQuery {
	limit: number
	offset: number
}

export function parseLogQuery(url: URL): ParsedLogQuery {
	const limitParam = url.searchParams.get("limit")
	const limit =
		limitParam && /^\d+$/.test(limitParam)
			? Math.min(Math.max(Number(limitParam), 1), MAX_LIMIT)
			: DEFAULT_LIMIT

	const offsetParam = url.searchParams.get("offset")
	const offset =
		offsetParam && /^\d+$/.test(offsetParam) ? Number(offsetParam) : 0

	return { limit, offset }
}

/** Omits defaults so pagination URLs stay short. */
export function buildLogQueryString(
	limit: number,
	offset: number,
	showHelp = true,
): string {
	const params = new URLSearchParams()
	if (limit !== DEFAULT_LIMIT) params.set("limit", String(limit))
	if (offset > 0) params.set("offset", String(offset))
	if (!showHelp) params.set("help", "0")
	const qs = params.toString()
	return qs ? `?${qs}` : ""
}

/**
 * Agent fetch tools tend to follow only URLs printed verbatim (query string
 * included), so every reachable view must appear somewhere as an absolute URL.
 */
function buildUrl(
	site: string,
	limit: number,
	offset: number,
	showHelp: boolean,
): string {
	return `${site}/log.md${buildLogQueryString(limit, offset, showHelp)}`
}

export function renderApiDoc(
	site: string,
	limit: number,
	offset: number,
): string {
	return [
		"## API",
		"",
		"Paginate this log by fetching the absolute links below. Some agent fetch tools only follow URLs printed verbatim (query string included), so prefer these exact links over editing the URL.",
		"",
		"Free-form parameters (for clients that can build URLs):",
		`- limit=<1-${MAX_LIMIT}>      Days per page. Default: ${DEFAULT_LIMIT}.`,
		"- offset=<n>        Days skipped from the most recent. Default: 0. Use the `Next page` URL to paginate.",
		"- help=<0|1>        0 hides this API section; links then keep it hidden.",
		"",
		`Hide this API section: ${buildUrl(site, limit, offset, false)}`,
	].join("\n")
}

export function renderDayBlock(day: DayLog): string {
	const labels = day.labels.length ? ` — ${day.labels.join(" · ")}` : ""
	return [
		`## ${day.date} (${weekdayName(day.date)})${labels}`,
		"",
		...day.skipped.map(
			(entry) => `- Skipped ${entry.planned}: ${skippedSummary(entry)}`,
		),
		...day.strength.map(
			({ ref, sets }) =>
				`- ${exerciseByRef(ref)?.name ?? ref}: ${sets.map(formatSet).join(" · ")}`,
		),
		...day.conditioning.map(
			(entry) =>
				`- ${entry.workout} (${entry.category}): ${conditioningSummary(entry)}`,
		),
		...day.wellness.map((entry) => `- Wellness: ${wellnessSummary(entry)}`),
	].join("\n")
}

// Paraphrased from the HTML app's purpose — keep in rough sync with README.md.
function renderIntro(site: string): string {
	return [
		"# Body — training log",
		"",
		"Goulven Clec'h's personal workout tracker: a barbell strength programme with double progression, home conditioning workouts, and daily wellness (sleep hours, steps).",
		"",
		`Markdown twin of ${site}/history/, for crawlers, LLMs, and no-JS readers. Days are listed newest first. Other entry points: ${site}/index.md (site entry and today's session), ${site}/stats.md (adherence, wellness, 1RM, tonnage), ${site}/llms.txt (site map).`,
	].join("\n")
}

export interface LogView {
	site: string
	limit: number
	offset: number
	showHelp: boolean
	days: DayLog[]
	totalDays: number
	totalEntries: number
	/** Entries this page's schemas could not parse, counted but not shown. */
	unreadable: number
}

export function renderLog(view: LogView): string {
	const { site, limit, offset, showHelp, days, totalDays, totalEntries } = view

	const apiDoc = showHelp
		? renderApiDoc(site, limit, offset)
		: [
				"## API",
				"",
				`API guide hidden. Show pagination options: ${buildUrl(site, limit, offset, true)}`,
			].join("\n")

	const rangeLine =
		days.length === 0
			? `Showing 0 of ${totalDays} days.`
			: `Showing days ${offset + 1}–${offset + days.length} of ${totalDays} · ${totalEntries} entries in total.`
	const unreadableLine =
		view.unreadable > 0
			? `${view.unreadable} ${view.unreadable === 1 ? "entry uses" : "entries use"} a newer format than this page understands and ${view.unreadable === 1 ? "is" : "are"} omitted.`
			: undefined

	const body = days.length
		? days.map(renderDayBlock).join("\n\n")
		: totalDays === 0
			? "Nothing logged yet."
			: `This page is past the end of the log. First page: ${buildUrl(site, limit, 0, showHelp)}`

	const paginationLines: string[] = []
	if (offset + limit < totalDays)
		paginationLines.push(
			`Next page: ${buildUrl(site, limit, offset + limit, showHelp)}`,
		)
	if (offset > 0)
		paginationLines.push(
			`Previous page: ${buildUrl(site, limit, Math.max(0, Math.min(offset, totalDays) - limit), showHelp)}`,
		)
	if (limit < MAX_LIMIT && totalDays > limit)
		paginationLines.push(
			`Max page size: ${buildUrl(site, MAX_LIMIT, 0, showHelp)}`,
		)

	const resultsBlock = [
		"## Sessions",
		"",
		[rangeLine, unreadableLine].filter(Boolean).join(" "),
		"",
		body,
		...(paginationLines.length ? ["", paginationLines.join("\n")] : []),
	].join("\n")

	return [renderIntro(site), "", apiDoc, "", resultsBlock, ""].join("\n")
}

export async function GET(context: APIContext): Promise<Response> {
	try {
		const site = context.site!.origin
		const { limit, offset } = parseLogQuery(context.url)
		const showHelp = context.url.searchParams.get("help") !== "0"

		const { entries, unreadable } = await fetchLog()
		const days = groupByDay(entries)

		const document = renderLog({
			site,
			limit,
			offset,
			showHelp,
			days: days.slice(offset, offset + limit),
			totalDays: days.length,
			totalEntries: entries.length,
			unreadable,
		})

		return new Response(document, {
			status: 200,
			headers: {
				"Content-Type": "text/markdown; charset=utf-8",
				// Shorter-lived than the main site's twins: a session logged an
				// hour ago is exactly what an analysis agent will ask about.
				"Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
				Link: `<${site}/history/>; rel="canonical"`,
				"X-Robots-Tag": "noindex",
			},
		})
	} catch (err) {
		console.error("GET /log.md failed:", err)
		return new Response("Unable to load log", {
			status: 500,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		})
	}
}
