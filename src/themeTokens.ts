export interface ThemeToken {
	name: string
	value: string
}

export interface TextSizeToken extends ThemeToken {
	lineHeight: string | null
}

export interface ThemeTokens {
	/** Light/dark pairs (light first) and single colours. */
	colors: ThemeToken[][]
	fontFamilies: ThemeToken[]
	textSizes: TextSizeToken[]
}

/** Tailwind namespaces sharing another one's prefix without belonging to it. */
const NESTED_NAMESPACES: Record<string, string[]> = {
	font: ["font-weight", "font-size"],
	text: [
		"text-color",
		"text-decoration-color",
		"text-decoration-thickness",
		"text-indent",
		"text-shadow",
		"text-underline-offset",
	],
}

export function parseThemeTokens(css: string): ThemeTokens {
	const declarations = themeDeclarations(css)
	return {
		colors: pairLightAndDark(tokensOf(declarations, "color")),
		fontFamilies: tokensOf(declarations, "font"),
		textSizes: tokensOf(declarations, "text").map(({ name, value }) => ({
			name,
			value,
			lineHeight: declarations.get(`--text-${name}--line-height`) ?? null,
		})),
	}
}

function themeDeclarations(css: string): Map<string, string> {
	const source = css.replace(/\/\*[\s\S]*?\*\//g, "")
	const declarations = new Map<string, string>()
	for (const opening of source.matchAll(/@theme\b[^{;]*\{/g)) {
		const block = blockBody(source, opening.index + opening[0].length)
		for (const [, property, value] of block.matchAll(
			/(--[\w-]+\*?)\s*:\s*([^;]+);/g,
		))
			applyDeclaration(
				declarations,
				property,
				value.replace(/\s+/g, " ").trim(),
			)
	}
	return declarations
}

function applyDeclaration(
	declarations: Map<string, string>,
	property: string,
	value: string,
): void {
	if (property.endsWith("-*")) {
		const namespace = property.slice(2, -2)
		for (const declared of declarations.keys())
			if (inNamespace(declared, namespace)) declarations.delete(declared)
	} else if (value === "initial") declarations.delete(property)
	else declarations.set(property, value)
}

/** Text of the block whose opening brace ends right before `start`. */
function blockBody(source: string, start: number): string {
	let depth = 1
	for (let index = start; index < source.length; index++) {
		if (source[index] === "{") depth++
		if (source[index] === "}") depth--
		if (depth === 0) return source.slice(start, index)
	}
	return source.slice(start)
}

function inNamespace(property: string, namespace: string): boolean {
	const nested = NESTED_NAMESPACES[namespace] ?? []
	return (
		property.startsWith(`--${namespace}-`) &&
		!nested.some((inner) => property.startsWith(`--${inner}-`))
	)
}

/** Sub-properties such as `--text-xs--line-height` aren't tokens. */
function tokensOf(
	declarations: Map<string, string>,
	namespace: string,
): ThemeToken[] {
	const prefixLength = `--${namespace}-`.length
	return [...declarations].flatMap(([property, value]) =>
		inNamespace(property, namespace) && !property.includes("--", 2)
			? [{ name: property.slice(prefixLength), value }]
			: [],
	)
}

function pairLightAndDark(colors: ThemeToken[]): ThemeToken[][] {
	const byName = new Map(colors.map((color) => [color.name, color]))
	return colors.flatMap((color): ThemeToken[][] => {
		const [, base, variant] = /^(.+)-(light|dark)$/.exec(color.name) ?? []
		const light = byName.get(`${base}-light`)
		const dark = byName.get(`${base}-dark`)
		if (base === undefined || light === undefined || dark === undefined)
			return [[color]]
		return variant === "light" ? [[light, dark]] : []
	})
}
