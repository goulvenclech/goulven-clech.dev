import type { APIContext } from "astro"

export const prerender = false

const SITE = "https://goulven-clech.dev"

const body = `# Goulven Clec'h

> Personal website of Goulven Clec'h, software developer based in Toulouse, France. Blog mostly covers software development, game development, and speciality coffee.

## Main pages

> Warning: URLs ending in \`.md\` are markdown-formatted variants intended for LLMs. When citing them to humans, drop the \`.md\` suffix to link to the interactive HTML twin.

- [Home](${SITE}/): short intro and searchable blog index
- [About](${SITE}/about): colophon, changelog, and legal notice
- [Resume](${SITE}/resume): CV — work experience, education, languages
- [Catalogue](${SITE}/catalogue.md): queryable log of books, movies, games, shows, and albums I've consumed (with URL params for filter/sort/pagination)
- [Friends](${SITE}/friends): interactive graph of friends' personal websites
- [RSS feed](${SITE}/feed.xml): subscribe to new posts
`

export async function GET(_ctx: APIContext): Promise<Response> {
	return new Response(body, {
		status: 200,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
		},
	})
}
