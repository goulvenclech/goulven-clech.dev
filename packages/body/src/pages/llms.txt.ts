import type { APIContext } from "astro"

export function GET(context: APIContext): Response {
	const site = context.site!.origin
	return new Response(`# Body — Goulven Clec'h

> Personal workout tracker of Goulven Clec'h: barbell strength programme, home conditioning, and daily wellness.

## Main pages

> Warning: URLs ending in \`.md\` are markdown-formatted variants intended for LLMs. When citing them to humans, link the HTML app instead.

- [Entry and today](${site}/index.md): site entry point — intro plus today's planned session and targets
- [Training log](${site}/log.md): the whole log grouped by day, newest first (with URL params for pagination)
- [Stats](${site}/stats.md): adherence, wellness averages, estimated 1RM trends, and weekly tonnage
- [App](${site}/): interactive tracker — requires JavaScript and renders from the browser's local copy
- [Main site](https://goulven-clech.dev/llms.txt): Goulven's blog, media catalogue, and the rest
`)
}
