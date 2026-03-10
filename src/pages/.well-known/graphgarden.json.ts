import type { APIContext } from "astro"
import { getCollection } from "astro:content"
import { isEntryPublished } from "src/blogUtils"
import { readFileSync } from "node:fs"
import { join } from "node:path"

export const prerender = true

interface GraphGardenNode {
	readonly url: string
	readonly title: string
}

interface GraphGardenEdge {
	readonly source: string
	readonly target: string
	readonly type: "internal" | "friend"
}

interface GraphGardenFile {
	readonly version: string
	readonly generated_at: string
	readonly base_url: string
	readonly site: {
		readonly title: string
		readonly description: string
		readonly language: string
	}
	readonly friends: readonly string[]
	readonly nodes: readonly GraphGardenNode[]
	readonly edges: readonly GraphGardenEdge[]
}

const FRIENDS = [
	"https://aureliendossantos.com/",
	"https://erika.florist/",
	"https://bruits.org/",
] as const

const STATIC_PAGES: readonly GraphGardenNode[] = [
	{ url: "/", title: "Home" },
	{ url: "/about", title: "About" },
	{ url: "/resume", title: "Resume" },
	{ url: "/catalogue", title: "Catalogue" },
	{ url: "/catalogue/wrapped", title: "Wrapped" },
] as const

const PAGE_FILES: ReadonlyArray<{
	readonly url: string
	readonly filePath: string
}> = [
	{ url: "/about", filePath: "about.astro" },
	{ url: "/resume", filePath: "resume.astro" },
	{ url: "/catalogue", filePath: "catalogue.astro" },
	{ url: "/catalogue/wrapped", filePath: "catalogue/wrapped.astro" },
] as const

const MARKDOWN_LINK_REGEX = /\[([^\]]*)\]\(([^)]+)\)/g
const HTML_LINK_REGEX = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/g
const SKIPPED_PROTOCOLS = ["#", "mailto:", "tel:", "javascript:"]

export function isFriendUrl(url: string): boolean {
	return FRIENDS.some((friend) => {
		const base = friend.replace(/\/$/, "")
		return url === base || url.startsWith(friend)
	})
}

export function normalizeUrl(url: string): string {
	return url === "/" ? url : url.replace(/\/$/, "")
}

function toRelativePath(url: string, siteOrigin: string): string {
	const path = url.startsWith(siteOrigin) ? url.slice(siteOrigin.length) : url
	// Ensure the path starts with /
	const withLeadingSlash = path.startsWith("/") ? path : `/${path}`
	return normalizeUrl(withLeadingSlash)
}

export function isInternalUrl(url: string, siteOrigin: string): boolean {
	return url.startsWith("/") || url.startsWith(siteOrigin)
}

function shouldSkipLink(url: string): boolean {
	return SKIPPED_PROTOCOLS.some((protocol) => url.startsWith(protocol))
}

function classifyLink(
	url: string,
	siteOrigin: string,
	links: Array<{ url: string; type: "internal" | "friend" }>,
): void {
	if (shouldSkipLink(url)) return

	if (isInternalUrl(url, siteOrigin)) {
		links.push({ url: toRelativePath(url, siteOrigin), type: "internal" })
	} else if (isFriendUrl(url)) {
		links.push({ url, type: "friend" })
	}
}

export function extractLinks(
	content: string,
	siteOrigin: string,
): ReadonlyArray<{
	readonly url: string
	readonly type: "internal" | "friend"
}> {
	const links: Array<{ url: string; type: "internal" | "friend" }> = []

	const markdownRegex = new RegExp(
		MARKDOWN_LINK_REGEX.source,
		MARKDOWN_LINK_REGEX.flags,
	)
	const htmlRegex = new RegExp(HTML_LINK_REGEX.source, HTML_LINK_REGEX.flags)

	let match: RegExpExecArray | null
	while ((match = markdownRegex.exec(content)) !== null) {
		classifyLink(match[2], siteOrigin, links)
	}

	while ((match = htmlRegex.exec(content)) !== null) {
		classifyLink(match[1], siteOrigin, links)
	}

	return links
}

export async function GET(context: APIContext) {
	const siteOrigin =
		context.site?.toString().replace(/\/$/, "") ?? "https://goulven-clech.dev"
	const baseUrl = siteOrigin + "/"

	const publishedEntries = await getCollection("blog", ({ data }) => {
		return isEntryPublished(data.published, true)
	})

	const years = [
		...new Set(publishedEntries.map((entry) => entry.data.date.getFullYear())),
	]

	const nodeMap = new Map<string, GraphGardenNode>()

	for (const page of STATIC_PAGES) {
		nodeMap.set(page.url, page)
	}

	for (const year of years) {
		const url = `/?year=${year}`
		nodeMap.set(url, { url, title: String(year) })
	}

	for (const entry of publishedEntries) {
		const url = `/${entry.id}`
		nodeMap.set(url, { url, title: entry.data.title })
	}

	// Build edges with deduplication per (source, target) pair
	const edgeSet = new Set<string>()
	const edges: GraphGardenEdge[] = []

	function addEdge(
		source: string,
		target: string,
		type: "internal" | "friend",
	) {
		const key = `${source} -> ${target}`
		if (edgeSet.has(key)) return
		edgeSet.add(key)
		edges.push({ source, target, type })
	}

	function readFileOrWarn(path: string, context: string): string | null {
		try {
			return readFileSync(path, "utf-8")
		} catch {
			console.warn(`[graphgarden] Failed to read ${context} at ${path}`)
			return null
		}
	}

	function addExtractedEdges(
		source: string,
		links: ReturnType<typeof extractLinks>,
	): void {
		for (const link of links) {
			if (link.type === "internal") {
				const normalizedTarget = normalizeUrl(link.url)
				if (nodeMap.has(normalizedTarget)) {
					addEdge(source, normalizedTarget, "internal")
				}
			} else {
				addEdge(source, link.url, "friend")
			}
		}
	}

	for (const page of STATIC_PAGES) {
		if (page.url !== "/" && page.url !== "/catalogue/wrapped") {
			addEdge(page.url, "/", "internal")
		}
	}
	addEdge("/catalogue/wrapped", "/catalogue", "internal")

	// Year nodes → home
	for (const year of years) {
		addEdge(`/?year=${year}`, "/", "internal")
	}

	// Blog entries → year nodes + links extracted from MDX content
	for (const entry of publishedEntries) {
		const entryUrl = `/${entry.id}`
		const year = entry.data.date.getFullYear()
		addEdge(entryUrl, `/?year=${year}`, "internal")

		const content = entry.body
		if (!content) continue

		addExtractedEdges(entryUrl, extractLinks(content, siteOrigin))
	}

	for (const pageFile of PAGE_FILES) {
		const fullPath = join(process.cwd(), "src", "pages", pageFile.filePath)

		const content = readFileOrWarn(fullPath, `page "${pageFile.url}"`)
		if (!content) continue

		addExtractedEdges(pageFile.url, extractLinks(content, siteOrigin))
	}

	const changelogEntries = await getCollection("changelog")

	for (const entry of changelogEntries) {
		const content = entry.body
		if (!content) continue

		addExtractedEdges("/about", extractLinks(content, siteOrigin))

		if (entry.data.url && !shouldSkipLink(entry.data.url)) {
			if (isInternalUrl(entry.data.url, siteOrigin)) {
				const normalizedTarget = normalizeUrl(
					toRelativePath(entry.data.url, siteOrigin),
				)
				if (nodeMap.has(normalizedTarget)) {
					addEdge("/about", normalizedTarget, "internal")
				}
			} else if (isFriendUrl(entry.data.url)) {
				addEdge("/about", entry.data.url, "friend")
			}
		}
	}

	const experienceEntries = await getCollection("experiences", ({ data }) => {
		return data.is_draft !== true
	})

	for (const entry of experienceEntries) {
		const content = entry.body
		if (!content) continue

		addExtractedEdges("/resume", extractLinks(content, siteOrigin))
	}

	const graphGardenFile: GraphGardenFile = {
		version: "0.2.0",
		generated_at: new Date().toISOString(),
		base_url: baseUrl,
		site: {
			title: "Goulven CLEC'H",
			description:
				"I'm a software developer based in Toulouse, France. Welcome to my personal website!",
			language: "en",
		},
		friends: FRIENDS.map((url) => url.replace(/\/$/, "")),
		nodes: [...nodeMap.values()],
		edges,
	}

	return new Response(JSON.stringify(graphGardenFile, null, 2), {
		headers: { "Content-Type": "application/json" },
	})
}
