import { formatDayShort, localDateOf } from "../dates"
import { readLog } from "../logStore"
import { EXERCISES, WEEKLY_PLAN } from "../program"
import type { LogEntry } from "../schemas"
import {
	ADHERENCE_DAYS,
	TREND_WEEKS,
	WELLNESS_DAYS,
	adherence,
	dailyWellnessTrend,
	oneRepMaxTrends,
	weeklyTonnage,
	type DailyTrend,
	type OneRepMaxTrend,
	type WeeklyPoint,
} from "../stats"
import { el, storageErrorNote } from "./dom"
import { sync } from "./sync"
import { trendChart } from "./trendChart"

const MUTED = "text-muted-light dark:text-muted-dark"

// Halves are the finest plate increment worth displaying.
const roundKg = (value: number) => Math.round(value * 2) / 2

export async function renderStats(
	root: HTMLElement,
	autoSync = true,
): Promise<void> {
	const today = localDateOf(new Date())
	let log: LogEntry[]
	try {
		log = await readLog()
	} catch {
		root.replaceChildren(storageErrorNote())
		return
	}
	// Stats hold no inputs, so freshly pulled entries can re-render freely.
	if (autoSync)
		void sync().then((result) => {
			if (result.pulled > 0) renderStats(root, false)
		})

	const attendance = adherence(log, WEEKLY_PLAN, today)
	const trends = oneRepMaxTrends(log, EXERCISES, today)
	const tonnage = weeklyTonnage(log, EXERCISES, today)
	const sleep = dailyWellnessTrend(log, "sleepHours", today)
	const steps = dailyWellnessTrend(log, "steps", today)

	root.replaceChildren(
		el("h2", {}, [`Adherence — last ${ADHERENCE_DAYS} days`]),
		el("section", { class: "panel numeric" }, [
			el("p", { class: "text-5xl font-black" }, [
				String(Math.round(attendance.ratio * 100)),
				el("span", { class: "text-2xl" }, ["%"]),
			]),
			el("p", { class: `${MUTED} mt-2 text-sm font-bold` }, [
				`${attendance.done}/${attendance.planned} scheduled sessions`,
			]),
		]),

		el("h2", {}, [`Wellness — last ${WELLNESS_DAYS} days`]),
		el("div", { class: "space-y-3" }, [
			wellnessPanel(
				sleep,
				(average) => [String(Math.round(average * 10) / 10), " h"],
				"No sleep logged yet.",
				`Sleep per night over the last ${WELLNESS_DAYS} days`,
			),
			wellnessPanel(
				steps,
				(average) => [String(Math.round(average)), " steps"],
				"No steps logged yet.",
				`Steps per day over the last ${WELLNESS_DAYS} days`,
			),
		]),

		el("h2", {}, [`Estimated 1RM — ${TREND_WEEKS} weeks, Epley`]),
		...(trends.length === 0
			? [
					el("p", { class: `${MUTED} text-sm font-bold` }, [
						"No sets logged yet.",
					]),
				]
			: [el("div", { class: "space-y-3" }, trends.map(trendPanel))]),

		el("h2", {}, [`Weekly tonnage — ${TREND_WEEKS} weeks`]),
		el("section", { class: "panel numeric space-y-2" }, tonnageBars(tonnage)),
	)
}

function wellnessPanel(
	trend: DailyTrend,
	format: (average: number) => [big: string, unit: string],
	empty: string,
	label: string,
): HTMLElement {
	// Named per metric: two bare paragraphs share one heading.
	if (trend.average === null)
		return el("p", { class: `${MUTED} text-sm font-bold` }, [empty])

	const logged = trend.points.filter((point) => point.value !== null).length
	const [big, unit] = format(trend.average)
	const first = trend.points[0].date
	const last = trend.points[trend.points.length - 1].date

	return el("section", { class: "panel" }, [
		el("p", { class: "numeric text-5xl font-black" }, [
			big,
			el("span", { class: "text-2xl" }, [unit]),
		]),
		el("p", { class: `${MUTED} mt-2 text-sm font-bold` }, [
			`average over ${logged} logged ${logged === 1 ? "day" : "days"}`,
		]),
		el("div", { class: `${MUTED} mt-3` }, [
			trendChart(
				trend.points.map((point) => point.value),
				label,
			),
		]),
		el(
			"div",
			{ class: `${MUTED} mt-1 flex justify-between text-[10px] font-bold` },
			[
				el("p", {}, [formatDayShort(first)]),
				el("p", {}, [formatDayShort(last)]),
			],
		),
	])
}

function trendPanel(trend: OneRepMaxTrend): HTMLElement {
	const latest = [...trend.points]
		.reverse()
		.find((point) => point.value !== null)?.value

	return el("section", { class: "panel" }, [
		el("div", { class: "flex items-baseline justify-between gap-3" }, [
			el("p", { class: "text-sm font-extrabold" }, [trend.exercise.name]),
			el("p", { class: "numeric text-sm font-black" }, [
				latest == null ? "—" : `${roundKg(latest)} kg`,
			]),
		]),
		el("div", { class: `${MUTED} mt-3` }, [
			trendChart(
				trend.points.map((point) => point.value),
				`Estimated one-rep max for ${trend.exercise.name}, best per week`,
			),
		]),
		el(
			"div",
			{ class: `${MUTED} mt-1 flex justify-between text-[10px] font-bold` },
			[
				el("p", {}, [trend.points[0].week]),
				el("p", {}, [trend.points[trend.points.length - 1].week]),
			],
		),
	])
}

function tonnageBars(tonnage: WeeklyPoint[]): HTMLElement[] {
	const max = Math.max(...tonnage.map((point) => point.value ?? 0), 1)
	return tonnage.map((point) =>
		el("div", { class: "flex items-center gap-3" }, [
			el("p", { class: `${MUTED} w-14 text-[10px] font-extrabold` }, [
				point.week.slice(5),
			]),
			el(
				"div",
				{
					class:
						"bg-body-light dark:bg-body-dark h-2 flex-1 overflow-hidden rounded-full",
				},
				[
					el("div", {
						class: "bg-primary h-full rounded-full",
						style: `width: ${(((point.value ?? 0) / max) * 100).toFixed(1)}%`,
					}),
				],
			),
			el("p", { class: "w-16 text-right text-[10px] font-bold" }, [
				`${Math.round(point.value ?? 0)} kg`,
			]),
		]),
	)
}
